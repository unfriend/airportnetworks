#!/usr/bin/env python3
# /// script
# requires-python = ">=3.11"
# dependencies = ["openvr"]
# ///
"""The trackers' bridge: SteamVR's poses of the Vive trackers, the headset and its controllers and the base stations,
sent to the relay on this PC (tools/trackers/SPEC.md, "The bridge"; setting it up: tools/trackers/README.md).

    uv run bridge.py [--port 47800] [--rate 90]        after SteamVR is running; the relay: --lan --trackers
    uv run bridge.py --list                            the devices SteamVR sees now, then stop
    uv run bridge.py --fake [--seconds n]              made-up devices, no SteamVR (to try the rest without it)

uv (https://docs.astral.sh/uv/) reads the block above (PEP 723, inline script metadata) and runs it with a Python of
3.11 or newer and the openvr package (pyopenvr), at the versions in bridge.py.lock, fetching both the first time; plain
python bridge.py works as before where Python and pip install openvr are there. Python 3 (3.11 or newer on Windows
keeps the rate: its sleep is precise there), the openvr package and the standard library only. Browsers cannot read the
trackers, so this small helper reads every tracked device's pose in SteamVR's standing space (y up, the floor at 0:
SteamVR's own room setup) and sends one UDP datagram a reading to 127.0.0.1:<port>, as JSON:

    { "v": 1, "t": <ms>, "d": [{ "s": <serial>, "k": "trk" | "hmd" | "ctl" | "base", "h": "l" | "r" (controllers),
      "p": [x, y, z] (m), "q": [x, y, z, w], "lv": [3] (m/s), "av": [3] (rad/s), "ok": <tracked well>,
      "b": <battery 0..1 or null> }] }

under 8 KB (more devices than fit are sent in several). Serial numbers are the devices' ids everywhere (LHR-...),
stable across sessions. Nothing here listens or answers: the relay (relay/trackers.mjs) lines the trackers up with the
room and sends them on to the headsets and pages.
"""
import argparse
import json
import math
import socket
import sys
import time

MAX_DGRAM = 8000          # one datagram, bytes (the relay takes up to 8192)
BATTERY_EVERY = 10.0      # s between battery readings of a device (they change slowly; each asks SteamVR)
INFO_EVERY = 2.0          # s between looks at which devices there are (one may be switched on or off any time)
STATUS_EVERY = 5.0        # s between status lines
VERSION = 1


def quat(m):
    """The turn of a 3x4 pose matrix (rows), as [x, y, z, w] (three.js's setFromRotationMatrix), of length 1."""
    r00, r01, r02 = m[0][0], m[0][1], m[0][2]
    r10, r11, r12 = m[1][0], m[1][1], m[1][2]
    r20, r21, r22 = m[2][0], m[2][1], m[2][2]
    tr = r00 + r11 + r22
    if tr > 0:
        s = 0.5 / math.sqrt(tr + 1.0)
        w, x, y, z = 0.25 / s, (r21 - r12) * s, (r02 - r20) * s, (r10 - r01) * s
    elif r00 > r11 and r00 > r22:
        s = 2.0 * math.sqrt(max(1e-12, 1.0 + r00 - r11 - r22))
        w, x, y, z = (r21 - r12) / s, 0.25 * s, (r01 + r10) / s, (r02 + r20) / s
    elif r11 > r22:
        s = 2.0 * math.sqrt(max(1e-12, 1.0 + r11 - r00 - r22))
        w, x, y, z = (r02 - r20) / s, (r01 + r10) / s, 0.25 * s, (r12 + r21) / s
    else:
        s = 2.0 * math.sqrt(max(1e-12, 1.0 + r22 - r00 - r11))
        w, x, y, z = (r10 - r01) / s, (r02 + r20) / s, (r12 + r21) / s, 0.25 * s
    n = math.sqrt(x * x + y * y + z * z + w * w)
    if not n > 0:
        return None
    return [x / n, y / n, z / n, w / n]


def iv(x):
    """An openvr enum or ctypes value as a plain int (pyopenvr's constants and answers are ints; ctypes ones have .value)."""
    return int(getattr(x, 'value', x))


def r(v, n):
    return [round(float(x), n) for x in v]


def finite(v):
    return all(math.isfinite(x) for x in v)


def packs(readings, t):
    """The readings as datagrams, each under MAX_DGRAM bytes."""
    out, part = [], []
    for d in readings:
        part.append(d)
        if len(json.dumps({'v': VERSION, 't': t, 'd': part}, separators=(',', ':'))) > MAX_DGRAM and len(part) > 1:
            part.pop()
            out.append(part)
            part = [d]
    if part:
        out.append(part)
    return [json.dumps({'v': VERSION, 't': t, 'd': p}, separators=(',', ':')).encode('utf-8') for p in out]


class Steam:
    """The real thing: SteamVR through pyopenvr, as a background application (it never starts SteamVR, and SteamVR
    needs no scene application for the poses)."""

    def __init__(self):
        import openvr  # (here, so --fake needs no openvr)
        self.vr = openvr
        self.sys = None
        self.poses = (openvr.TrackedDevicePose_t * openvr.k_unMaxTrackedDeviceCount)()
        self.info = {}       # index -> { 'serial', 'k', 'h' }
        self.info_at = 0.0
        self.battery = {}    # index -> (value or None, when read)
        self.last = {}       # index -> the last good reading (sent with ok false while tracking is lost)
        self.event = openvr.VREvent_t()
        self.KIND = {
            iv(openvr.TrackedDeviceClass_GenericTracker): 'trk',
            iv(openvr.TrackedDeviceClass_HMD): 'hmd',
            iv(openvr.TrackedDeviceClass_Controller): 'ctl',
            iv(openvr.TrackedDeviceClass_TrackingReference): 'base',
        }
        self.LEFT, self.RIGHT = iv(openvr.TrackedControllerRole_LeftHand), iv(openvr.TrackedControllerRole_RightHand)
        self.RUNNING_OK, self.QUIT = iv(openvr.TrackingResult_Running_OK), iv(openvr.VREvent_Quit)

    def connect(self):
        """True once SteamVR answers (an error from openvr.init says why it does not)."""
        try:
            self.sys = self.vr.init(self.vr.VRApplication_Background)
        except Exception as err:  # (pyopenvr raises its own error classes; the words are what matters)
            self.sys = None
            self.why = str(err) or type(err).__name__
            return False
        self.info, self.info_at, self.battery, self.last = {}, 0.0, {}, {}
        return True

    def close(self):
        if self.sys is not None:
            try:
                self.vr.shutdown()
            except Exception:
                pass
        self.sys = None

    def quitting(self):
        """True when SteamVR says it is closing (then let go of it at once, as it asks)."""
        while self.sys.pollNextEvent(self.event):
            if iv(self.event.eventType) == self.QUIT:
                ack = getattr(self.sys, 'acknowledgeQuit_Exiting', None)
                if ack:
                    try:
                        ack()
                    except Exception:
                        pass
                return True
        return False

    def prop(self, kind, i, name):
        try:
            return getattr(self.sys, 'get%sTrackedDeviceProperty' % kind)(i, getattr(self.vr, name))
        except Exception:  # (a property this device has not: SteamVR answers with an error)
            return None

    def look(self, now):
        """Which devices there are, their serial numbers and, for a controller, its hand."""
        self.info_at = now
        info = {}
        for i in range(self.vr.k_unMaxTrackedDeviceCount):
            k = self.KIND.get(iv(self.sys.getTrackedDeviceClass(i)))
            if not k:
                continue
            serial = self.prop('String', i, 'Prop_SerialNumber_String')
            if isinstance(serial, bytes):
                serial = serial.decode('utf-8', 'replace')
            serial = (serial or '').strip()
            if not serial:
                continue
            h = None
            if k == 'ctl':
                role = iv(self.sys.getControllerRoleForTrackedDeviceIndex(i))
                h = 'l' if role == self.LEFT else 'r' if role == self.RIGHT else None
            info[i] = {'serial': serial[:64], 'k': k, 'h': h}
        self.info = info

    def charge(self, i, now):
        v, at = self.battery.get(i, (None, -1e9))
        if now - at >= BATTERY_EVERY:
            v = None
            if self.prop('Bool', i, 'Prop_DeviceProvidesBatteryStatus_Bool'):
                b = self.prop('Float', i, 'Prop_DeviceBatteryPercentage_Float')
                v = round(min(1.0, max(0.0, float(b))), 2) if b is not None and math.isfinite(b) else None
            self.battery[i] = (v, now)
        return v

    def poll(self):
        """Every device's pose now (0 s ahead) in the standing universe. pyopenvr 1.1 and newer fill the array they are
        given (and return it); its older wrappers took the count before the array."""
        try:
            got = self.sys.getDeviceToAbsoluteTrackingPose(self.vr.TrackingUniverseStanding, 0, self.poses)
        except TypeError:
            got = self.sys.getDeviceToAbsoluteTrackingPose(self.vr.TrackingUniverseStanding, 0, len(self.poses), self.poses)
        return got if got is not None and hasattr(got, '__len__') and len(got) >= len(self.poses) else self.poses

    def read(self, now):
        if now - self.info_at >= INFO_EVERY:
            self.look(now)
        poses = self.poll()
        out = []
        for i, d in self.info.items():
            pose = poses[i]
            if not pose.bDeviceIsConnected:
                self.last.pop(i, None)
                continue
            ok = bool(pose.bPoseIsValid) and iv(pose.eTrackingResult) == self.RUNNING_OK
            if pose.bPoseIsValid:
                m = pose.mDeviceToAbsoluteTracking.m
                p = [m[0][3], m[1][3], m[2][3]]
                q = quat(m)
                lv = [pose.vVelocity.v[j] for j in range(3)]
                av = [pose.vAngularVelocity.v[j] for j in range(3)]
                if q is not None and finite(p) and finite(lv) and finite(av):
                    self.last[i] = (r(p, 4), r(q, 4), r(lv, 3), r(av, 3))
                else:
                    ok = False
            if i not in self.last:
                continue  # (never had a pose: nothing to say yet)
            p, q, lv, av = self.last[i]
            e = {'s': d['serial'], 'k': d['k'], 'p': p, 'q': q, 'lv': lv if ok else [0, 0, 0], 'av': av if ok else [0, 0, 0],
                 'ok': ok, 'b': self.charge(i, now)}
            if d['h']:
                e['h'] = d['h']
            out.append(e)
        return out


class Fake:
    """Made-up devices (no SteamVR), as tools/trackers/fake.mjs's: SteamVR's space is the room turned 30 degrees and
    moved by (1.2, 0.01, -0.7) m; two trackers lie on spot A and spot B, 2 m apart, one goes round a circle, one bobs,
    one lies on a table; the headset, its two controllers and two base stations."""
    TURN, MOVE = math.pi / 6, (1.2, 0.01, -0.7)

    def __init__(self):
        self.t0 = time.monotonic()   # (read() is given time.monotonic(): the same clock)

    def connect(self):
        return True

    def close(self):
        pass

    def quitting(self):
        return False

    @staticmethod
    def yaw(a):
        return [0.0, math.sin(a / 2), 0.0, math.cos(a / 2)]

    @staticmethod
    def mul(a, b):
        return [a[3] * b[0] + a[0] * b[3] + a[1] * b[2] - a[2] * b[1], a[3] * b[1] - a[0] * b[2] + a[1] * b[3] + a[2] * b[0],
                a[3] * b[2] + a[0] * b[1] - a[1] * b[0] + a[2] * b[3], a[3] * b[3] - a[0] * b[0] - a[1] * b[1] - a[2] * b[2]]

    def raw(self, p):  # the room to SteamVR's space
        c, s = math.cos(self.TURN), math.sin(self.TURN)
        return [c * p[0] + s * p[2] + self.MOVE[0], p[1] + self.MOVE[1], -s * p[0] + c * p[2] + self.MOVE[2]]

    def read(self, now):
        t = now - self.t0
        a = t * math.pi / 2
        devices = [
            ('LHR-FA4E0A01', 'trk', None, 0.9, [0.0, 0.0, 0.0], [0, 0, 0, 1]),
            ('LHR-FA4E0B02', 'trk', None, 0.85, [2.0, 0.0, 0.0], [0, 0, 0, 1]),
            ('LHR-FA4E0C03', 'trk', None, 0.7, [1 + 0.8 * math.cos(a), 1.0, -1.5 - 0.8 * math.sin(a)], self.yaw(a)),
            ('LHR-FA4E0D04', 'trk', None, 0.55, [-0.5, 0.9 + 0.15 * math.sin(t * 2), -1.0], [0, 0, 0, 1]),
            ('LHR-FA4E0E05', 'trk', None, 0.4, [1.5, 0.75, -0.5], self.yaw(math.pi / 6)),
            ('LHR-FA4EF0D0', 'hmd', None, None, [0.5, 1.65, 0.8], self.yaw(0.4 * math.sin(t / 3))),
            ('LHR-FA4EC0L1', 'ctl', 'l', 0.8, [0.3, 1.2 + 0.1 * math.sin(t * 1.3), 0.55], [0, 0, 0, 1]),
            ('LHR-FA4EC0R2', 'ctl', 'r', 0.75, [0.7, 1.25, 0.5 + 0.1 * math.cos(t)], [0, 0, 0, 1]),
            ('LHB-FA4EBA01', 'base', None, None, [-1.5, 2.3, 1.5], self.yaw(-math.pi / 4)),
            ('LHB-FA4EBA02', 'base', None, None, [3.5, 2.3, -3.5], self.yaw(3 * math.pi / 4)),
        ]
        out = []
        for s, k, h, b, p, q in devices:
            e = {'s': s, 'k': k, 'p': r(self.raw(p), 4), 'q': r(self.mul(self.yaw(self.TURN), q), 4), 'lv': [0, 0, 0], 'av': [0, 0, 0], 'ok': True, 'b': b}
            if h:
                e['h'] = h
            out.append(e)
        return out


def names(readings):
    n = {'trk': 0, 'hmd': 0, 'ctl': 0, 'base': 0}
    good = sum(1 for d in readings if d['k'] == 'trk' and d['ok'])
    for d in readings:
        n[d['k']] += 1
    parts = ['%d trackers (%d tracked well)' % (n['trk'], good)]
    if n['hmd']:
        parts.append('the headset')
    if n['ctl']:
        parts.append('%d controllers' % n['ctl'])
    if n['base']:
        parts.append('%d base stations' % n['base'])
    return ', '.join(parts)


def main():
    ap = argparse.ArgumentParser(description='SteamVR\'s trackers to the relay on this PC (tools/trackers/README.md).')
    ap.add_argument('--port', type=int, default=47800, help='the relay\'s --trackers port on 127.0.0.1 (47800)')
    ap.add_argument('--rate', type=float, default=90.0, help='readings a second, at most (90)')
    ap.add_argument('--fake', action='store_true', help='made-up devices, no SteamVR')
    ap.add_argument('--list', action='store_true', help='print the devices SteamVR sees now, then stop')
    ap.add_argument('--seconds', type=float, default=0.0, help='stop after this long (0: run until stopped)')
    ap.add_argument('--quiet', action='store_true', help='no status lines')
    a = ap.parse_args()
    if not (0 < a.port < 65536) or not (1 <= a.rate <= 1000):
        ap.error('--port 1 to 65535, --rate 1 to 1000')
    say = (lambda *x: None) if a.quiet else (lambda *x: print(*x, flush=True))

    if a.fake:
        src = Fake()
    else:
        try:
            src = Steam()
        except ImportError:
            print('The openvr package is missing: pip install openvr (then start this again). --fake runs without it.', flush=True)
            return 1
    sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    if hasattr(socket, 'SIO_UDP_CONNRESET'):  # (Windows: a datagram nobody took must not fail the next send)
        try:
            sock.ioctl(socket.SIO_UDP_CONNRESET, False)
        except (OSError, ValueError):
            pass
    dest = ('127.0.0.1', a.port)

    start = time.monotonic()
    while not src.connect():
        if a.list or (a.seconds and time.monotonic() - start >= a.seconds):
            print('SteamVR does not answer (%s): start SteamVR first.' % src.why, flush=True)
            return 1
        say('Waiting for SteamVR (%s): start it, and this goes on by itself.' % src.why)
        time.sleep(5)

    if a.list:
        time.sleep(0.2)
        readings = src.read(time.monotonic())
        print(names(readings))
        for d in readings:
            print('  %-14s %-4s %s %s  battery %s  at %s' % (d['s'], d['k'], d.get('h') or ' ', 'ok  ' if d['ok'] else 'LOST',
                  '-' if d['b'] is None else '%d %%' % round(d['b'] * 100), d['p']))
        src.close()
        return 0

    say('Sending %s readings a second to UDP 127.0.0.1:%d (the relay: --trackers%s)%s.' %
        (('%g' % a.rate), a.port, '' if a.port == 47800 else ' %d' % a.port, ' (made up: --fake)' if a.fake else ''))
    period, nxt, status_at, sent, failed, count, said_fail = 1.0 / a.rate, time.monotonic(), time.monotonic(), 0, 0, 0, False
    readings = []
    try:
        while True:
            now = time.monotonic()
            if a.seconds and now - start >= a.seconds:
                break
            if src.quitting():
                src.close()
                say('SteamVR is closing: waiting for it to start again.')
                while not src.connect():
                    time.sleep(5)
                say('SteamVR is back.')
            readings = src.read(now)
            t = int(time.time() * 1000)
            for data in packs(readings, t):
                try:
                    sock.sendto(data, dest)
                    sent += 1
                except OSError as err:
                    failed += 1
                    if not said_fail:
                        said_fail = True
                        say('Could not send to UDP 127.0.0.1:%d (%s): is the relay running with --trackers?' % (a.port, err))
            count += 1
            if now - status_at >= STATUS_EVERY:
                say('%s; %.0f readings a second%s' % (names(readings), count / (now - status_at), '' if not failed else ', %d datagrams not sent' % failed))
                status_at, count, failed = now, 0, 0
            nxt += period
            if nxt < now - 0.5:  # (fell behind, as after the PC slept: start again from now)
                nxt = now + period
            time.sleep(max(0.0, nxt - time.monotonic()))
    except KeyboardInterrupt:
        pass
    finally:
        src.close()
        sock.close()
    return 0


if __name__ == '__main__':
    sys.exit(main())
