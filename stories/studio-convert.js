// three.js r128's own add-ons (three@0.128.0, examples/js; MIT, as three.min.js: three.LICENSE.txt), unchanged, and
// meshoptimizer 1.3.0's simplifier (MIT, as its first line says), unchanged but for its last line (an ES module's export)
(self.STUDIO_PARTS = self.STUDIO_PARTS || {})["convert"] = { v: '00a5d6426be3', make: function (THREE, fflate) {
'use strict';
( function () {
	class NURBSUtils {
		static findSpan( p, u, U ) {
			const n = U.length - p - 1;
			if ( u >= U[ n ] ) {
				return n - 1;
			}
			if ( u <= U[ p ] ) {
				return p;
			}
			let low = p;
			let high = n;
			let mid = Math.floor( ( low + high ) / 2 );
			while ( u < U[ mid ] || u >= U[ mid + 1 ] ) {
				if ( u < U[ mid ] ) {
					high = mid;
				} else {
					low = mid;
				}
				mid = Math.floor( ( low + high ) / 2 );
			}
			return mid;
		}
		static calcBasisFunctions( span, u, p, U ) {
			const N = [];
			const left = [];
			const right = [];
			N[ 0 ] = 1.0;
			for ( let j = 1; j <= p; ++ j ) {
				left[ j ] = u - U[ span + 1 - j ];
				right[ j ] = U[ span + j ] - u;
				let saved = 0.0;
				for ( let r = 0; r < j; ++ r ) {
					const rv = right[ r + 1 ];
					const lv = left[ j - r ];
					const temp = N[ r ] / ( rv + lv );
					N[ r ] = saved + rv * temp;
					saved = lv * temp;
				}
				N[ j ] = saved;
			}
			return N;
		}
		static calcBSplinePoint( p, U, P, u ) {
			const span = this.findSpan( p, u, U );
			const N = this.calcBasisFunctions( span, u, p, U );
			const C = new THREE.Vector4( 0, 0, 0, 0 );
			for ( let j = 0; j <= p; ++ j ) {
				const point = P[ span - p + j ];
				const Nj = N[ j ];
				const wNj = point.w * Nj;
				C.x += point.x * wNj;
				C.y += point.y * wNj;
				C.z += point.z * wNj;
				C.w += point.w * Nj;
			}
			return C;
		}
		static calcBasisFunctionDerivatives( span, u, p, n, U ) {
			const zeroArr = [];
			for ( let i = 0; i <= p; ++ i ) zeroArr[ i ] = 0.0;
			const ders = [];
			for ( let i = 0; i <= n; ++ i ) ders[ i ] = zeroArr.slice( 0 );
			const ndu = [];
			for ( let i = 0; i <= p; ++ i ) ndu[ i ] = zeroArr.slice( 0 );
			ndu[ 0 ][ 0 ] = 1.0;
			const left = zeroArr.slice( 0 );
			const right = zeroArr.slice( 0 );
			for ( let j = 1; j <= p; ++ j ) {
				left[ j ] = u - U[ span + 1 - j ];
				right[ j ] = U[ span + j ] - u;
				let saved = 0.0;
				for ( let r = 0; r < j; ++ r ) {
					const rv = right[ r + 1 ];
					const lv = left[ j - r ];
					ndu[ j ][ r ] = rv + lv;
					const temp = ndu[ r ][ j - 1 ] / ndu[ j ][ r ];
					ndu[ r ][ j ] = saved + rv * temp;
					saved = lv * temp;
				}
				ndu[ j ][ j ] = saved;
			}
			for ( let j = 0; j <= p; ++ j ) {
				ders[ 0 ][ j ] = ndu[ j ][ p ];
			}
			for ( let r = 0; r <= p; ++ r ) {
				let s1 = 0;
				let s2 = 1;
				const a = [];
				for ( let i = 0; i <= p; ++ i ) {
					a[ i ] = zeroArr.slice( 0 );
				}
				a[ 0 ][ 0 ] = 1.0;
				for ( let k = 1; k <= n; ++ k ) {
					let d = 0.0;
					const rk = r - k;
					const pk = p - k;
					if ( r >= k ) {
						a[ s2 ][ 0 ] = a[ s1 ][ 0 ] / ndu[ pk + 1 ][ rk ];
						d = a[ s2 ][ 0 ] * ndu[ rk ][ pk ];
					}
					const j1 = rk >= - 1 ? 1 : - rk;
					const j2 = r - 1 <= pk ? k - 1 : p - r;
					for ( let j = j1; j <= j2; ++ j ) {
						a[ s2 ][ j ] = ( a[ s1 ][ j ] - a[ s1 ][ j - 1 ] ) / ndu[ pk + 1 ][ rk + j ];
						d += a[ s2 ][ j ] * ndu[ rk + j ][ pk ];
					}
					if ( r <= pk ) {
						a[ s2 ][ k ] = - a[ s1 ][ k - 1 ] / ndu[ pk + 1 ][ r ];
						d += a[ s2 ][ k ] * ndu[ r ][ pk ];
					}
					ders[ k ][ r ] = d;
					const j = s1;
					s1 = s2;
					s2 = j;
				}
			}
			let r = p;
			for ( let k = 1; k <= n; ++ k ) {
				for ( let j = 0; j <= p; ++ j ) {
					ders[ k ][ j ] *= r;
				}
				r *= p - k;
			}
			return ders;
		}
		static calcBSplineDerivatives( p, U, P, u, nd ) {
			const du = nd < p ? nd : p;
			const CK = [];
			const span = this.findSpan( p, u, U );
			const nders = this.calcBasisFunctionDerivatives( span, u, p, du, U );
			const Pw = [];
			for ( let i = 0; i < P.length; ++ i ) {
				const point = P[ i ].clone();
				const w = point.w;
				point.x *= w;
				point.y *= w;
				point.z *= w;
				Pw[ i ] = point;
			}
			for ( let k = 0; k <= du; ++ k ) {
				const point = Pw[ span - p ].clone().multiplyScalar( nders[ k ][ 0 ] );
				for ( let j = 1; j <= p; ++ j ) {
					point.add( Pw[ span - p + j ].clone().multiplyScalar( nders[ k ][ j ] ) );
				}
				CK[ k ] = point;
			}
			for ( let k = du + 1; k <= nd + 1; ++ k ) {
				CK[ k ] = new THREE.Vector4( 0, 0, 0 );
			}
			return CK;
		}
		static calcKoverI( k, i ) {
			let nom = 1;
			for ( let j = 2; j <= k; ++ j ) {
				nom *= j;
			}
			let denom = 1;
			for ( let j = 2; j <= i; ++ j ) {
				denom *= j;
			}
			for ( let j = 2; j <= k - i; ++ j ) {
				denom *= j;
			}
			return nom / denom;
		}
		static calcRationalCurveDerivatives( Pders ) {
			const nd = Pders.length;
			const Aders = [];
			const wders = [];
			for ( let i = 0; i < nd; ++ i ) {
				const point = Pders[ i ];
				Aders[ i ] = new THREE.Vector3( point.x, point.y, point.z );
				wders[ i ] = point.w;
			}
			const CK = [];
			for ( let k = 0; k < nd; ++ k ) {
				const v = Aders[ k ].clone();
				for ( let i = 1; i <= k; ++ i ) {
					v.sub( CK[ k - i ].clone().multiplyScalar( this.calcKoverI( k, i ) * wders[ i ] ) );
				}
				CK[ k ] = v.divideScalar( wders[ 0 ] );
			}
			return CK;
		}
		static calcNURBSDerivatives( p, U, P, u, nd ) {
			const Pders = this.calcBSplineDerivatives( p, U, P, u, nd );
			return this.calcRationalCurveDerivatives( Pders );
		}
		static calcSurfacePoint( p, q, U, V, P, u, v, target ) {
			const uspan = this.findSpan( p, u, U );
			const vspan = this.findSpan( q, v, V );
			const Nu = this.calcBasisFunctions( uspan, u, p, U );
			const Nv = this.calcBasisFunctions( vspan, v, q, V );
			const temp = [];
			for ( let l = 0; l <= q; ++ l ) {
				temp[ l ] = new THREE.Vector4( 0, 0, 0, 0 );
				for ( let k = 0; k <= p; ++ k ) {
					const point = P[ uspan - p + k ][ vspan - q + l ].clone();
					const w = point.w;
					point.x *= w;
					point.y *= w;
					point.z *= w;
					temp[ l ].add( point.multiplyScalar( Nu[ k ] ) );
				}
			}
			const Sw = new THREE.Vector4( 0, 0, 0, 0 );
			for ( let l = 0; l <= q; ++ l ) {
				Sw.add( temp[ l ].multiplyScalar( Nv[ l ] ) );
			}
			Sw.divideScalar( Sw.w );
			target.set( Sw.x, Sw.y, Sw.z );
		}
	}
	THREE.NURBSUtils = NURBSUtils;
} )();
( function () {
	class NURBSCurve extends THREE.Curve {
		constructor( degree, knots
			, controlPoints
			, startKnot
			, endKnot
		) {
			super();
			this.degree = degree;
			this.knots = knots;
			this.controlPoints = [];
			this.startKnot = startKnot || 0;
			this.endKnot = endKnot || this.knots.length - 1;
			for ( let i = 0; i < controlPoints.length; ++ i ) {
				const point = controlPoints[ i ];
				this.controlPoints[ i ] = new THREE.Vector4( point.x, point.y, point.z, point.w );
			}
		}
		getPoint( t, optionalTarget = new THREE.Vector3() ) {
			const point = optionalTarget;
			const u = this.knots[ this.startKnot ] + t * ( this.knots[ this.endKnot ] - this.knots[ this.startKnot ] );
			const hpoint = THREE.NURBSUtils.calcBSplinePoint( this.degree, this.knots, this.controlPoints, u );
			if ( hpoint.w !== 1.0 ) {
				hpoint.divideScalar( hpoint.w );
			}
			return point.set( hpoint.x, hpoint.y, hpoint.z );
		}
		getTangent( t, optionalTarget = new THREE.Vector3() ) {
			const tangent = optionalTarget;
			const u = this.knots[ 0 ] + t * ( this.knots[ this.knots.length - 1 ] - this.knots[ 0 ] );
			const ders = THREE.NURBSUtils.calcNURBSDerivatives( this.degree, this.knots, this.controlPoints, u, 1 );
			tangent.copy( ders[ 1 ] ).normalize();
			return tangent;
		}
	}
	THREE.NURBSCurve = NURBSCurve;
} )();
( function () {
	class TGALoader extends THREE.DataTextureLoader {
		constructor( manager ) {
			super( manager );
		}
		parse( buffer ) {
			function tgaCheckHeader( header ) {
				switch ( header.image_type ) {
					case TGA_TYPE_INDEXED:
					case TGA_TYPE_RLE_INDEXED:
						if ( header.colormap_length > 256 || header.colormap_size !== 24 || header.colormap_type !== 1 ) {
							console.error( 'THREE.TGALoader: Invalid type colormap data for indexed type.' );
						}
						break;
					case TGA_TYPE_RGB:
					case TGA_TYPE_GREY:
					case TGA_TYPE_RLE_RGB:
					case TGA_TYPE_RLE_GREY:
						if ( header.colormap_type ) {
							console.error( 'THREE.TGALoader: Invalid type colormap data for colormap type.' );
						}
						break;
					case TGA_TYPE_NO_DATA:
						console.error( 'THREE.TGALoader: No data.' );
					default:
						console.error( 'THREE.TGALoader: Invalid type "%s".', header.image_type );
				}
				if ( header.width <= 0 || header.height <= 0 ) {
					console.error( 'THREE.TGALoader: Invalid image size.' );
				}
				if ( header.pixel_size !== 8 && header.pixel_size !== 16 && header.pixel_size !== 24 && header.pixel_size !== 32 ) {
					console.error( 'THREE.TGALoader: Invalid pixel size "%s".', header.pixel_size );
				}
			}
			function tgaParse( use_rle, use_pal, header, offset, data ) {
				let pixel_data, palettes;
				const pixel_size = header.pixel_size >> 3;
				const pixel_total = header.width * header.height * pixel_size;
				if ( use_pal ) {
					palettes = data.subarray( offset, offset += header.colormap_length * ( header.colormap_size >> 3 ) );
				}
				if ( use_rle ) {
					pixel_data = new Uint8Array( pixel_total );
					let c, count, i;
					let shift = 0;
					const pixels = new Uint8Array( pixel_size );
					while ( shift < pixel_total ) {
						c = data[ offset ++ ];
						count = ( c & 0x7f ) + 1;
						if ( c & 0x80 ) {
							for ( i = 0; i < pixel_size; ++ i ) {
								pixels[ i ] = data[ offset ++ ];
							}
							for ( i = 0; i < count; ++ i ) {
								pixel_data.set( pixels, shift + i * pixel_size );
							}
							shift += pixel_size * count;
						} else {
							count *= pixel_size;
							for ( i = 0; i < count; ++ i ) {
								pixel_data[ shift + i ] = data[ offset ++ ];
							}
							shift += count;
						}
					}
				} else {
					pixel_data = data.subarray( offset, offset += use_pal ? header.width * header.height : pixel_total );
				}
				return {
					pixel_data: pixel_data,
					palettes: palettes
				};
			}
			function tgaGetImageData8bits( imageData, y_start, y_step, y_end, x_start, x_step, x_end, image, palettes ) {
				const colormap = palettes;
				let color,
					i = 0,
					x,
					y;
				const width = header.width;
				for ( y = y_start; y !== y_end; y += y_step ) {
					for ( x = x_start; x !== x_end; x += x_step, i ++ ) {
						color = image[ i ];
						imageData[ ( x + width * y ) * 4 + 3 ] = 255;
						imageData[ ( x + width * y ) * 4 + 2 ] = colormap[ color * 3 + 0 ];
						imageData[ ( x + width * y ) * 4 + 1 ] = colormap[ color * 3 + 1 ];
						imageData[ ( x + width * y ) * 4 + 0 ] = colormap[ color * 3 + 2 ];
					}
				}
				return imageData;
			}
			function tgaGetImageData16bits( imageData, y_start, y_step, y_end, x_start, x_step, x_end, image ) {
				let color,
					i = 0,
					x,
					y;
				const width = header.width;
				for ( y = y_start; y !== y_end; y += y_step ) {
					for ( x = x_start; x !== x_end; x += x_step, i += 2 ) {
						color = image[ i + 0 ] + ( image[ i + 1 ] << 8 );
						imageData[ ( x + width * y ) * 4 + 0 ] = ( color & 0x7C00 ) >> 7;
						imageData[ ( x + width * y ) * 4 + 1 ] = ( color & 0x03E0 ) >> 2;
						imageData[ ( x + width * y ) * 4 + 2 ] = ( color & 0x001F ) >> 3;
						imageData[ ( x + width * y ) * 4 + 3 ] = color & 0x8000 ? 0 : 255;
					}
				}
				return imageData;
			}
			function tgaGetImageData24bits( imageData, y_start, y_step, y_end, x_start, x_step, x_end, image ) {
				let i = 0,
					x,
					y;
				const width = header.width;
				for ( y = y_start; y !== y_end; y += y_step ) {
					for ( x = x_start; x !== x_end; x += x_step, i += 3 ) {
						imageData[ ( x + width * y ) * 4 + 3 ] = 255;
						imageData[ ( x + width * y ) * 4 + 2 ] = image[ i + 0 ];
						imageData[ ( x + width * y ) * 4 + 1 ] = image[ i + 1 ];
						imageData[ ( x + width * y ) * 4 + 0 ] = image[ i + 2 ];
					}
				}
				return imageData;
			}
			function tgaGetImageData32bits( imageData, y_start, y_step, y_end, x_start, x_step, x_end, image ) {
				let i = 0,
					x,
					y;
				const width = header.width;
				for ( y = y_start; y !== y_end; y += y_step ) {
					for ( x = x_start; x !== x_end; x += x_step, i += 4 ) {
						imageData[ ( x + width * y ) * 4 + 2 ] = image[ i + 0 ];
						imageData[ ( x + width * y ) * 4 + 1 ] = image[ i + 1 ];
						imageData[ ( x + width * y ) * 4 + 0 ] = image[ i + 2 ];
						imageData[ ( x + width * y ) * 4 + 3 ] = image[ i + 3 ];
					}
				}
				return imageData;
			}
			function tgaGetImageDataGrey8bits( imageData, y_start, y_step, y_end, x_start, x_step, x_end, image ) {
				let color,
					i = 0,
					x,
					y;
				const width = header.width;
				for ( y = y_start; y !== y_end; y += y_step ) {
					for ( x = x_start; x !== x_end; x += x_step, i ++ ) {
						color = image[ i ];
						imageData[ ( x + width * y ) * 4 + 0 ] = color;
						imageData[ ( x + width * y ) * 4 + 1 ] = color;
						imageData[ ( x + width * y ) * 4 + 2 ] = color;
						imageData[ ( x + width * y ) * 4 + 3 ] = 255;
					}
				}
				return imageData;
			}
			function tgaGetImageDataGrey16bits( imageData, y_start, y_step, y_end, x_start, x_step, x_end, image ) {
				let i = 0,
					x,
					y;
				const width = header.width;
				for ( y = y_start; y !== y_end; y += y_step ) {
					for ( x = x_start; x !== x_end; x += x_step, i += 2 ) {
						imageData[ ( x + width * y ) * 4 + 0 ] = image[ i + 0 ];
						imageData[ ( x + width * y ) * 4 + 1 ] = image[ i + 0 ];
						imageData[ ( x + width * y ) * 4 + 2 ] = image[ i + 0 ];
						imageData[ ( x + width * y ) * 4 + 3 ] = image[ i + 1 ];
					}
				}
				return imageData;
			}
			function getTgaRGBA( data, width, height, image, palette ) {
				let x_start, y_start, x_step, y_step, x_end, y_end;
				switch ( ( header.flags & TGA_ORIGIN_MASK ) >> TGA_ORIGIN_SHIFT ) {
					default:
					case TGA_ORIGIN_UL:
						x_start = 0;
						x_step = 1;
						x_end = width;
						y_start = 0;
						y_step = 1;
						y_end = height;
						break;
					case TGA_ORIGIN_BL:
						x_start = 0;
						x_step = 1;
						x_end = width;
						y_start = height - 1;
						y_step = - 1;
						y_end = - 1;
						break;
					case TGA_ORIGIN_UR:
						x_start = width - 1;
						x_step = - 1;
						x_end = - 1;
						y_start = 0;
						y_step = 1;
						y_end = height;
						break;
					case TGA_ORIGIN_BR:
						x_start = width - 1;
						x_step = - 1;
						x_end = - 1;
						y_start = height - 1;
						y_step = - 1;
						y_end = - 1;
						break;
				}
				if ( use_grey ) {
					switch ( header.pixel_size ) {
						case 8:
							tgaGetImageDataGrey8bits( data, y_start, y_step, y_end, x_start, x_step, x_end, image );
							break;
						case 16:
							tgaGetImageDataGrey16bits( data, y_start, y_step, y_end, x_start, x_step, x_end, image );
							break;
						default:
							console.error( 'THREE.TGALoader: Format not supported.' );
							break;
					}
				} else {
					switch ( header.pixel_size ) {
						case 8:
							tgaGetImageData8bits( data, y_start, y_step, y_end, x_start, x_step, x_end, image, palette );
							break;
						case 16:
							tgaGetImageData16bits( data, y_start, y_step, y_end, x_start, x_step, x_end, image );
							break;
						case 24:
							tgaGetImageData24bits( data, y_start, y_step, y_end, x_start, x_step, x_end, image );
							break;
						case 32:
							tgaGetImageData32bits( data, y_start, y_step, y_end, x_start, x_step, x_end, image );
							break;
						default:
							console.error( 'THREE.TGALoader: Format not supported.' );
							break;
					}
				}
				return data;
			}
			const TGA_TYPE_NO_DATA = 0,
				TGA_TYPE_INDEXED = 1,
				TGA_TYPE_RGB = 2,
				TGA_TYPE_GREY = 3,
				TGA_TYPE_RLE_INDEXED = 9,
				TGA_TYPE_RLE_RGB = 10,
				TGA_TYPE_RLE_GREY = 11,
				TGA_ORIGIN_MASK = 0x30,
				TGA_ORIGIN_SHIFT = 0x04,
				TGA_ORIGIN_BL = 0x00,
				TGA_ORIGIN_BR = 0x01,
				TGA_ORIGIN_UL = 0x02,
				TGA_ORIGIN_UR = 0x03;
			if ( buffer.length < 19 ) console.error( 'THREE.TGALoader: Not enough data to contain header.' );
			let offset = 0;
			const content = new Uint8Array( buffer ),
				header = {
					id_length: content[ offset ++ ],
					colormap_type: content[ offset ++ ],
					image_type: content[ offset ++ ],
					colormap_index: content[ offset ++ ] | content[ offset ++ ] << 8,
					colormap_length: content[ offset ++ ] | content[ offset ++ ] << 8,
					colormap_size: content[ offset ++ ],
					origin: [ content[ offset ++ ] | content[ offset ++ ] << 8, content[ offset ++ ] | content[ offset ++ ] << 8 ],
					width: content[ offset ++ ] | content[ offset ++ ] << 8,
					height: content[ offset ++ ] | content[ offset ++ ] << 8,
					pixel_size: content[ offset ++ ],
					flags: content[ offset ++ ]
				};
			tgaCheckHeader( header );
			if ( header.id_length + offset > buffer.length ) {
				console.error( 'THREE.TGALoader: No data.' );
			}
			offset += header.id_length;
			let use_rle = false,
				use_pal = false,
				use_grey = false;
			switch ( header.image_type ) {
				case TGA_TYPE_RLE_INDEXED:
					use_rle = true;
					use_pal = true;
					break;
				case TGA_TYPE_INDEXED:
					use_pal = true;
					break;
				case TGA_TYPE_RLE_RGB:
					use_rle = true;
					break;
				case TGA_TYPE_RGB:
					break;
				case TGA_TYPE_RLE_GREY:
					use_rle = true;
					use_grey = true;
					break;
				case TGA_TYPE_GREY:
					use_grey = true;
					break;
			}
			const imageData = new Uint8Array( header.width * header.height * 4 );
			const result = tgaParse( use_rle, use_pal, header, offset, content );
			getTgaRGBA( imageData, header.width, header.height, result.pixel_data, result.palettes );
			return {
				data: imageData,
				width: header.width,
				height: header.height,
				flipY: true,
				generateMipmaps: true,
				minFilter: THREE.LinearMipmapLinearFilter
			};
		}
	}
	THREE.TGALoader = TGALoader;
} )();
( function () {
	let fbxTree;
	let connections;
	let sceneGraph;
	class FBXLoader extends THREE.Loader {
		constructor( manager ) {
			super( manager );
		}
		load( url, onLoad, onProgress, onError ) {
			const scope = this;
			const path = scope.path === '' ? THREE.LoaderUtils.extractUrlBase( url ) : scope.path;
			const loader = new THREE.FileLoader( this.manager );
			loader.setPath( scope.path );
			loader.setResponseType( 'arraybuffer' );
			loader.setRequestHeader( scope.requestHeader );
			loader.setWithCredentials( scope.withCredentials );
			loader.load( url, function ( buffer ) {
				try {
					onLoad( scope.parse( buffer, path ) );
				} catch ( e ) {
					if ( onError ) {
						onError( e );
					} else {
						console.error( e );
					}
					scope.manager.itemError( url );
				}
			}, onProgress, onError );
		}
		parse( FBXBuffer, path ) {
			if ( isFbxFormatBinary( FBXBuffer ) ) {
				fbxTree = new BinaryParser().parse( FBXBuffer );
			} else {
				const FBXText = convertArrayBufferToString( FBXBuffer );
				if ( ! isFbxFormatASCII( FBXText ) ) {
					throw new Error( 'THREE.FBXLoader: Unknown format.' );
				}
				if ( getFbxVersion( FBXText ) < 7000 ) {
					throw new Error( 'THREE.FBXLoader: FBX version not supported, FileVersion: ' + getFbxVersion( FBXText ) );
				}
				fbxTree = new TextParser().parse( FBXText );
			}
			const textureLoader = new THREE.TextureLoader( this.manager ).setPath( this.resourcePath || path ).setCrossOrigin( this.crossOrigin );
			return new FBXTreeParser( textureLoader, this.manager ).parse( fbxTree );
		}
	}
	class FBXTreeParser {
		constructor( textureLoader, manager ) {
			this.textureLoader = textureLoader;
			this.manager = manager;
		}
		parse() {
			connections = this.parseConnections();
			const images = this.parseImages();
			const textures = this.parseTextures( images );
			const materials = this.parseMaterials( textures );
			const deformers = this.parseDeformers();
			const geometryMap = new GeometryParser().parse( deformers );
			this.parseScene( deformers, geometryMap, materials );
			return sceneGraph;
		}
		parseConnections() {
			const connectionMap = new Map();
			if ( 'Connections' in fbxTree ) {
				const rawConnections = fbxTree.Connections.connections;
				rawConnections.forEach( function ( rawConnection ) {
					const fromID = rawConnection[ 0 ];
					const toID = rawConnection[ 1 ];
					const relationship = rawConnection[ 2 ];
					if ( ! connectionMap.has( fromID ) ) {
						connectionMap.set( fromID, {
							parents: [],
							children: []
						} );
					}
					const parentRelationship = {
						ID: toID,
						relationship: relationship
					};
					connectionMap.get( fromID ).parents.push( parentRelationship );
					if ( ! connectionMap.has( toID ) ) {
						connectionMap.set( toID, {
							parents: [],
							children: []
						} );
					}
					const childRelationship = {
						ID: fromID,
						relationship: relationship
					};
					connectionMap.get( toID ).children.push( childRelationship );
				} );
			}
			return connectionMap;
		}
		parseImages() {
			const images = {};
			const blobs = {};
			if ( 'Video' in fbxTree.Objects ) {
				const videoNodes = fbxTree.Objects.Video;
				for ( const nodeID in videoNodes ) {
					const videoNode = videoNodes[ nodeID ];
					const id = parseInt( nodeID );
					images[ id ] = videoNode.RelativeFilename || videoNode.Filename;
					if ( 'Content' in videoNode ) {
						const arrayBufferContent = videoNode.Content instanceof ArrayBuffer && videoNode.Content.byteLength > 0;
						const base64Content = typeof videoNode.Content === 'string' && videoNode.Content !== '';
						if ( arrayBufferContent || base64Content ) {
							const image = this.parseImage( videoNodes[ nodeID ] );
							blobs[ videoNode.RelativeFilename || videoNode.Filename ] = image;
						}
					}
				}
			}
			for ( const id in images ) {
				const filename = images[ id ];
				if ( blobs[ filename ] !== undefined ) images[ id ] = blobs[ filename ]; else images[ id ] = images[ id ].split( '\\' ).pop();
			}
			return images;
		}
		parseImage( videoNode ) {
			const content = videoNode.Content;
			const fileName = videoNode.RelativeFilename || videoNode.Filename;
			const extension = fileName.slice( fileName.lastIndexOf( '.' ) + 1 ).toLowerCase();
			let type;
			switch ( extension ) {
				case 'bmp':
					type = 'image/bmp';
					break;
				case 'jpg':
				case 'jpeg':
					type = 'image/jpeg';
					break;
				case 'png':
					type = 'image/png';
					break;
				case 'tif':
					type = 'image/tiff';
					break;
				case 'tga':
					if ( this.manager.getHandler( '.tga' ) === null ) {
						console.warn( 'FBXLoader: TGA loader not found, skipping ', fileName );
					}
					type = 'image/tga';
					break;
				default:
					console.warn( 'FBXLoader: Image type "' + extension + '" is not supported.' );
					return;
			}
			if ( typeof content === 'string' ) {
				return 'data:' + type + ';base64,' + content;
			} else {
				const array = new Uint8Array( content );
				return window.URL.createObjectURL( new Blob( [ array ], {
					type: type
				} ) );
			}
		}
		parseTextures( images ) {
			const textureMap = new Map();
			if ( 'Texture' in fbxTree.Objects ) {
				const textureNodes = fbxTree.Objects.Texture;
				for ( const nodeID in textureNodes ) {
					const texture = this.parseTexture( textureNodes[ nodeID ], images );
					textureMap.set( parseInt( nodeID ), texture );
				}
			}
			return textureMap;
		}
		parseTexture( textureNode, images ) {
			const texture = this.loadTexture( textureNode, images );
			texture.ID = textureNode.id;
			texture.name = textureNode.attrName;
			const wrapModeU = textureNode.WrapModeU;
			const wrapModeV = textureNode.WrapModeV;
			const valueU = wrapModeU !== undefined ? wrapModeU.value : 0;
			const valueV = wrapModeV !== undefined ? wrapModeV.value : 0;
			texture.wrapS = valueU === 0 ? THREE.RepeatWrapping : THREE.ClampToEdgeWrapping;
			texture.wrapT = valueV === 0 ? THREE.RepeatWrapping : THREE.ClampToEdgeWrapping;
			if ( 'Scaling' in textureNode ) {
				const values = textureNode.Scaling.value;
				texture.repeat.x = values[ 0 ];
				texture.repeat.y = values[ 1 ];
			}
			return texture;
		}
		loadTexture( textureNode, images ) {
			let fileName;
			const currentPath = this.textureLoader.path;
			const children = connections.get( textureNode.id ).children;
			if ( children !== undefined && children.length > 0 && images[ children[ 0 ].ID ] !== undefined ) {
				fileName = images[ children[ 0 ].ID ];
				if ( fileName.indexOf( 'blob:' ) === 0 || fileName.indexOf( 'data:' ) === 0 ) {
					this.textureLoader.setPath( undefined );
				}
			}
			let texture;
			const extension = textureNode.FileName.slice( - 3 ).toLowerCase();
			if ( extension === 'tga' ) {
				const loader = this.manager.getHandler( '.tga' );
				if ( loader === null ) {
					console.warn( 'FBXLoader: TGA loader not found, creating placeholder texture for', textureNode.RelativeFilename );
					texture = new THREE.Texture();
				} else {
					texture = loader.load( fileName );
				}
			} else if ( extension === 'psd' ) {
				console.warn( 'FBXLoader: PSD textures are not supported, creating placeholder texture for', textureNode.RelativeFilename );
				texture = new THREE.Texture();
			} else {
				texture = this.textureLoader.load( fileName );
			}
			this.textureLoader.setPath( currentPath );
			return texture;
		}
		parseMaterials( textureMap ) {
			const materialMap = new Map();
			if ( 'Material' in fbxTree.Objects ) {
				const materialNodes = fbxTree.Objects.Material;
				for ( const nodeID in materialNodes ) {
					const material = this.parseMaterial( materialNodes[ nodeID ], textureMap );
					if ( material !== null ) materialMap.set( parseInt( nodeID ), material );
				}
			}
			return materialMap;
		}
		parseMaterial( materialNode, textureMap ) {
			const ID = materialNode.id;
			const name = materialNode.attrName;
			let type = materialNode.ShadingModel;
			if ( typeof type === 'object' ) {
				type = type.value;
			}
			if ( ! connections.has( ID ) ) return null;
			const parameters = this.parseParameters( materialNode, textureMap, ID );
			let material;
			switch ( type.toLowerCase() ) {
				case 'phong':
					material = new THREE.MeshPhongMaterial();
					break;
				case 'lambert':
					material = new THREE.MeshLambertMaterial();
					break;
				default:
					console.warn( 'THREE.FBXLoader: unknown material type "%s". Defaulting to THREE.MeshPhongMaterial.', type );
					material = new THREE.MeshPhongMaterial();
					break;
			}
			material.setValues( parameters );
			material.name = name;
			return material;
		}
		parseParameters( materialNode, textureMap, ID ) {
			const parameters = {};
			if ( materialNode.BumpFactor ) {
				parameters.bumpScale = materialNode.BumpFactor.value;
			}
			if ( materialNode.Diffuse ) {
				parameters.color = new THREE.Color().fromArray( materialNode.Diffuse.value );
			} else if ( materialNode.DiffuseColor && ( materialNode.DiffuseColor.type === 'Color' || materialNode.DiffuseColor.type === 'ColorRGB' ) ) {
				parameters.color = new THREE.Color().fromArray( materialNode.DiffuseColor.value );
			}
			if ( materialNode.DisplacementFactor ) {
				parameters.displacementScale = materialNode.DisplacementFactor.value;
			}
			if ( materialNode.Emissive ) {
				parameters.emissive = new THREE.Color().fromArray( materialNode.Emissive.value );
			} else if ( materialNode.EmissiveColor && ( materialNode.EmissiveColor.type === 'Color' || materialNode.EmissiveColor.type === 'ColorRGB' ) ) {
				parameters.emissive = new THREE.Color().fromArray( materialNode.EmissiveColor.value );
			}
			if ( materialNode.EmissiveFactor ) {
				parameters.emissiveIntensity = parseFloat( materialNode.EmissiveFactor.value );
			}
			if ( materialNode.Opacity ) {
				parameters.opacity = parseFloat( materialNode.Opacity.value );
			}
			if ( parameters.opacity < 1.0 ) {
				parameters.transparent = true;
			}
			if ( materialNode.ReflectionFactor ) {
				parameters.reflectivity = materialNode.ReflectionFactor.value;
			}
			if ( materialNode.Shininess ) {
				parameters.shininess = materialNode.Shininess.value;
			}
			if ( materialNode.Specular ) {
				parameters.specular = new THREE.Color().fromArray( materialNode.Specular.value );
			} else if ( materialNode.SpecularColor && materialNode.SpecularColor.type === 'Color' ) {
				parameters.specular = new THREE.Color().fromArray( materialNode.SpecularColor.value );
			}
			const scope = this;
			connections.get( ID ).children.forEach( function ( child ) {
				const type = child.relationship;
				switch ( type ) {
					case 'Bump':
						parameters.bumpMap = scope.getTexture( textureMap, child.ID );
						break;
					case 'Maya|TEX_ao_map':
						parameters.aoMap = scope.getTexture( textureMap, child.ID );
						break;
					case 'DiffuseColor':
					case 'Maya|TEX_color_map':
						parameters.map = scope.getTexture( textureMap, child.ID );
						parameters.map.encoding = THREE.sRGBEncoding;
						break;
					case 'DisplacementColor':
						parameters.displacementMap = scope.getTexture( textureMap, child.ID );
						break;
					case 'EmissiveColor':
						parameters.emissiveMap = scope.getTexture( textureMap, child.ID );
						parameters.emissiveMap.encoding = THREE.sRGBEncoding;
						break;
					case 'NormalMap':
					case 'Maya|TEX_normal_map':
						parameters.normalMap = scope.getTexture( textureMap, child.ID );
						break;
					case 'ReflectionColor':
						parameters.envMap = scope.getTexture( textureMap, child.ID );
						parameters.envMap.mapping = THREE.EquirectangularReflectionMapping;
						parameters.envMap.encoding = THREE.sRGBEncoding;
						break;
					case 'SpecularColor':
						parameters.specularMap = scope.getTexture( textureMap, child.ID );
						parameters.specularMap.encoding = THREE.sRGBEncoding;
						break;
					case 'TransparentColor':
					case 'TransparencyFactor':
						parameters.alphaMap = scope.getTexture( textureMap, child.ID );
						parameters.transparent = true;
						break;
					case 'AmbientColor':
					case 'ShininessExponent':
					case 'SpecularFactor':
					case 'VectorDisplacementColor':
					default:
						console.warn( 'THREE.FBXLoader: %s map is not supported in three.js, skipping texture.', type );
						break;
				}
			} );
			return parameters;
		}
		getTexture( textureMap, id ) {
			if ( 'LayeredTexture' in fbxTree.Objects && id in fbxTree.Objects.LayeredTexture ) {
				console.warn( 'THREE.FBXLoader: layered textures are not supported in three.js. Discarding all but first layer.' );
				id = connections.get( id ).children[ 0 ].ID;
			}
			return textureMap.get( id );
		}
		parseDeformers() {
			const skeletons = {};
			const morphTargets = {};
			if ( 'Deformer' in fbxTree.Objects ) {
				const DeformerNodes = fbxTree.Objects.Deformer;
				for ( const nodeID in DeformerNodes ) {
					const deformerNode = DeformerNodes[ nodeID ];
					const relationships = connections.get( parseInt( nodeID ) );
					if ( deformerNode.attrType === 'Skin' ) {
						const skeleton = this.parseSkeleton( relationships, DeformerNodes );
						skeleton.ID = nodeID;
						if ( relationships.parents.length > 1 ) console.warn( 'THREE.FBXLoader: skeleton attached to more than one geometry is not supported.' );
						skeleton.geometryID = relationships.parents[ 0 ].ID;
						skeletons[ nodeID ] = skeleton;
					} else if ( deformerNode.attrType === 'BlendShape' ) {
						const morphTarget = {
							id: nodeID
						};
						morphTarget.rawTargets = this.parseMorphTargets( relationships, DeformerNodes );
						morphTarget.id = nodeID;
						if ( relationships.parents.length > 1 ) console.warn( 'THREE.FBXLoader: morph target attached to more than one geometry is not supported.' );
						morphTargets[ nodeID ] = morphTarget;
					}
				}
			}
			return {
				skeletons: skeletons,
				morphTargets: morphTargets
			};
		}
		parseSkeleton( relationships, deformerNodes ) {
			const rawBones = [];
			relationships.children.forEach( function ( child ) {
				const boneNode = deformerNodes[ child.ID ];
				if ( boneNode.attrType !== 'Cluster' ) return;
				const rawBone = {
					ID: child.ID,
					indices: [],
					weights: [],
					transformLink: new THREE.Matrix4().fromArray( boneNode.TransformLink.a )
				};
				if ( 'Indexes' in boneNode ) {
					rawBone.indices = boneNode.Indexes.a;
					rawBone.weights = boneNode.Weights.a;
				}
				rawBones.push( rawBone );
			} );
			return {
				rawBones: rawBones,
				bones: []
			};
		}
		parseMorphTargets( relationships, deformerNodes ) {
			const rawMorphTargets = [];
			for ( let i = 0; i < relationships.children.length; i ++ ) {
				const child = relationships.children[ i ];
				const morphTargetNode = deformerNodes[ child.ID ];
				const rawMorphTarget = {
					name: morphTargetNode.attrName,
					initialWeight: morphTargetNode.DeformPercent,
					id: morphTargetNode.id,
					fullWeights: morphTargetNode.FullWeights.a
				};
				if ( morphTargetNode.attrType !== 'BlendShapeChannel' ) return;
				rawMorphTarget.geoID = connections.get( parseInt( child.ID ) ).children.filter( function ( child ) {
					return child.relationship === undefined;
				} )[ 0 ].ID;
				rawMorphTargets.push( rawMorphTarget );
			}
			return rawMorphTargets;
		}
		parseScene( deformers, geometryMap, materialMap ) {
			sceneGraph = new THREE.Group();
			const modelMap = this.parseModels( deformers.skeletons, geometryMap, materialMap );
			const modelNodes = fbxTree.Objects.Model;
			const scope = this;
			modelMap.forEach( function ( model ) {
				const modelNode = modelNodes[ model.ID ];
				scope.setLookAtProperties( model, modelNode );
				const parentConnections = connections.get( model.ID ).parents;
				parentConnections.forEach( function ( connection ) {
					const parent = modelMap.get( connection.ID );
					if ( parent !== undefined ) parent.add( model );
				} );
				if ( model.parent === null ) {
					sceneGraph.add( model );
				}
			} );
			this.bindSkeleton( deformers.skeletons, geometryMap, modelMap );
			this.createAmbientLight();
			this.setupMorphMaterials();
			sceneGraph.traverse( function ( node ) {
				if ( node.userData.transformData ) {
					if ( node.parent ) {
						node.userData.transformData.parentMatrix = node.parent.matrix;
						node.userData.transformData.parentMatrixWorld = node.parent.matrixWorld;
					}
					const transform = generateTransform( node.userData.transformData );
					node.applyMatrix4( transform );
					node.updateWorldMatrix();
				}
			} );
			const animations = new AnimationParser().parse();
			if ( sceneGraph.children.length === 1 && sceneGraph.children[ 0 ].isGroup ) {
				sceneGraph.children[ 0 ].animations = animations;
				sceneGraph = sceneGraph.children[ 0 ];
			}
			sceneGraph.animations = animations;
		}
		parseModels( skeletons, geometryMap, materialMap ) {
			const modelMap = new Map();
			const modelNodes = fbxTree.Objects.Model;
			for ( const nodeID in modelNodes ) {
				const id = parseInt( nodeID );
				const node = modelNodes[ nodeID ];
				const relationships = connections.get( id );
				let model = this.buildSkeleton( relationships, skeletons, id, node.attrName );
				if ( ! model ) {
					switch ( node.attrType ) {
						case 'Camera':
							model = this.createCamera( relationships );
							break;
						case 'Light':
							model = this.createLight( relationships );
							break;
						case 'Mesh':
							model = this.createMesh( relationships, geometryMap, materialMap );
							break;
						case 'NurbsCurve':
							model = this.createCurve( relationships, geometryMap );
							break;
						case 'LimbNode':
						case 'Root':
							model = new THREE.Bone();
							break;
						case 'Null':
						default:
							model = new THREE.Group();
							break;
					}
					model.name = node.attrName ? THREE.PropertyBinding.sanitizeNodeName( node.attrName ) : '';
					model.ID = id;
				}
				this.getTransformData( model, node );
				modelMap.set( id, model );
			}
			return modelMap;
		}
		buildSkeleton( relationships, skeletons, id, name ) {
			let bone = null;
			relationships.parents.forEach( function ( parent ) {
				for ( const ID in skeletons ) {
					const skeleton = skeletons[ ID ];
					skeleton.rawBones.forEach( function ( rawBone, i ) {
						if ( rawBone.ID === parent.ID ) {
							const subBone = bone;
							bone = new THREE.Bone();
							bone.matrixWorld.copy( rawBone.transformLink );
							bone.name = name ? THREE.PropertyBinding.sanitizeNodeName( name ) : '';
							bone.ID = id;
							skeleton.bones[ i ] = bone;
							if ( subBone !== null ) {
								bone.add( subBone );
							}
						}
					} );
				}
			} );
			return bone;
		}
		createCamera( relationships ) {
			let model;
			let cameraAttribute;
			relationships.children.forEach( function ( child ) {
				const attr = fbxTree.Objects.NodeAttribute[ child.ID ];
				if ( attr !== undefined ) {
					cameraAttribute = attr;
				}
			} );
			if ( cameraAttribute === undefined ) {
				model = new THREE.Object3D();
			} else {
				let type = 0;
				if ( cameraAttribute.CameraProjectionType !== undefined && cameraAttribute.CameraProjectionType.value === 1 ) {
					type = 1;
				}
				let nearClippingPlane = 1;
				if ( cameraAttribute.NearPlane !== undefined ) {
					nearClippingPlane = cameraAttribute.NearPlane.value / 1000;
				}
				let farClippingPlane = 1000;
				if ( cameraAttribute.FarPlane !== undefined ) {
					farClippingPlane = cameraAttribute.FarPlane.value / 1000;
				}
				let width = window.innerWidth;
				let height = window.innerHeight;
				if ( cameraAttribute.AspectWidth !== undefined && cameraAttribute.AspectHeight !== undefined ) {
					width = cameraAttribute.AspectWidth.value;
					height = cameraAttribute.AspectHeight.value;
				}
				const aspect = width / height;
				let fov = 45;
				if ( cameraAttribute.FieldOfView !== undefined ) {
					fov = cameraAttribute.FieldOfView.value;
				}
				const focalLength = cameraAttribute.FocalLength ? cameraAttribute.FocalLength.value : null;
				switch ( type ) {
					case 0:
						model = new THREE.PerspectiveCamera( fov, aspect, nearClippingPlane, farClippingPlane );
						if ( focalLength !== null ) model.setFocalLength( focalLength );
						break;
					case 1:
						model = new THREE.OrthographicCamera( - width / 2, width / 2, height / 2, - height / 2, nearClippingPlane, farClippingPlane );
						break;
					default:
						console.warn( 'THREE.FBXLoader: Unknown camera type ' + type + '.' );
						model = new THREE.Object3D();
						break;
				}
			}
			return model;
		}
		createLight( relationships ) {
			let model;
			let lightAttribute;
			relationships.children.forEach( function ( child ) {
				const attr = fbxTree.Objects.NodeAttribute[ child.ID ];
				if ( attr !== undefined ) {
					lightAttribute = attr;
				}
			} );
			if ( lightAttribute === undefined ) {
				model = new THREE.Object3D();
			} else {
				let type;
				if ( lightAttribute.LightType === undefined ) {
					type = 0;
				} else {
					type = lightAttribute.LightType.value;
				}
				let color = 0xffffff;
				if ( lightAttribute.Color !== undefined ) {
					color = new THREE.Color().fromArray( lightAttribute.Color.value );
				}
				let intensity = lightAttribute.Intensity === undefined ? 1 : lightAttribute.Intensity.value / 100;
				if ( lightAttribute.CastLightOnObject !== undefined && lightAttribute.CastLightOnObject.value === 0 ) {
					intensity = 0;
				}
				let distance = 0;
				if ( lightAttribute.FarAttenuationEnd !== undefined ) {
					if ( lightAttribute.EnableFarAttenuation !== undefined && lightAttribute.EnableFarAttenuation.value === 0 ) {
						distance = 0;
					} else {
						distance = lightAttribute.FarAttenuationEnd.value;
					}
				}
				const decay = 1;
				switch ( type ) {
					case 0:
						model = new THREE.PointLight( color, intensity, distance, decay );
						break;
					case 1:
						model = new THREE.DirectionalLight( color, intensity );
						break;
					case 2:
						let angle = Math.PI / 3;
						if ( lightAttribute.InnerAngle !== undefined ) {
							angle = THREE.MathUtils.degToRad( lightAttribute.InnerAngle.value );
						}
						let penumbra = 0;
						if ( lightAttribute.OuterAngle !== undefined ) {
							penumbra = THREE.MathUtils.degToRad( lightAttribute.OuterAngle.value );
							penumbra = Math.max( penumbra, 1 );
						}
						model = new THREE.SpotLight( color, intensity, distance, angle, penumbra, decay );
						break;
					default:
						console.warn( 'THREE.FBXLoader: Unknown light type ' + lightAttribute.LightType.value + ', defaulting to a THREE.PointLight.' );
						model = new THREE.PointLight( color, intensity );
						break;
				}
				if ( lightAttribute.CastShadows !== undefined && lightAttribute.CastShadows.value === 1 ) {
					model.castShadow = true;
				}
			}
			return model;
		}
		createMesh( relationships, geometryMap, materialMap ) {
			let model;
			let geometry = null;
			let material = null;
			const materials = [];
			relationships.children.forEach( function ( child ) {
				if ( geometryMap.has( child.ID ) ) {
					geometry = geometryMap.get( child.ID );
				}
				if ( materialMap.has( child.ID ) ) {
					materials.push( materialMap.get( child.ID ) );
				}
			} );
			if ( materials.length > 1 ) {
				material = materials;
			} else if ( materials.length > 0 ) {
				material = materials[ 0 ];
			} else {
				material = new THREE.MeshPhongMaterial( {
					color: 0xcccccc
				} );
				materials.push( material );
			}
			if ( 'color' in geometry.attributes ) {
				materials.forEach( function ( material ) {
					material.vertexColors = true;
				} );
			}
			if ( geometry.FBX_Deformer ) {
				materials.forEach( function ( material ) {
					material.skinning = true;
				} );
				model = new THREE.SkinnedMesh( geometry, material );
				model.normalizeSkinWeights();
			} else {
				model = new THREE.Mesh( geometry, material );
			}
			return model;
		}
		createCurve( relationships, geometryMap ) {
			const geometry = relationships.children.reduce( function ( geo, child ) {
				if ( geometryMap.has( child.ID ) ) geo = geometryMap.get( child.ID );
				return geo;
			}, null );
			const material = new THREE.LineBasicMaterial( {
				color: 0x3300ff,
				linewidth: 1
			} );
			return new THREE.Line( geometry, material );
		}
		getTransformData( model, modelNode ) {
			const transformData = {};
			if ( 'InheritType' in modelNode ) transformData.inheritType = parseInt( modelNode.InheritType.value );
			if ( 'RotationOrder' in modelNode ) transformData.eulerOrder = getEulerOrder( modelNode.RotationOrder.value ); else transformData.eulerOrder = 'ZYX';
			if ( 'Lcl_Translation' in modelNode ) transformData.translation = modelNode.Lcl_Translation.value;
			if ( 'PreRotation' in modelNode ) transformData.preRotation = modelNode.PreRotation.value;
			if ( 'Lcl_Rotation' in modelNode ) transformData.rotation = modelNode.Lcl_Rotation.value;
			if ( 'PostRotation' in modelNode ) transformData.postRotation = modelNode.PostRotation.value;
			if ( 'Lcl_Scaling' in modelNode ) transformData.scale = modelNode.Lcl_Scaling.value;
			if ( 'ScalingOffset' in modelNode ) transformData.scalingOffset = modelNode.ScalingOffset.value;
			if ( 'ScalingPivot' in modelNode ) transformData.scalingPivot = modelNode.ScalingPivot.value;
			if ( 'RotationOffset' in modelNode ) transformData.rotationOffset = modelNode.RotationOffset.value;
			if ( 'RotationPivot' in modelNode ) transformData.rotationPivot = modelNode.RotationPivot.value;
			model.userData.transformData = transformData;
		}
		setLookAtProperties( model, modelNode ) {
			if ( 'LookAtProperty' in modelNode ) {
				const children = connections.get( model.ID ).children;
				children.forEach( function ( child ) {
					if ( child.relationship === 'LookAtProperty' ) {
						const lookAtTarget = fbxTree.Objects.Model[ child.ID ];
						if ( 'Lcl_Translation' in lookAtTarget ) {
							const pos = lookAtTarget.Lcl_Translation.value;
							if ( model.target !== undefined ) {
								model.target.position.fromArray( pos );
								sceneGraph.add( model.target );
							} else {
								model.lookAt( new THREE.Vector3().fromArray( pos ) );
							}
						}
					}
				} );
			}
		}
		bindSkeleton( skeletons, geometryMap, modelMap ) {
			const bindMatrices = this.parsePoseNodes();
			for ( const ID in skeletons ) {
				const skeleton = skeletons[ ID ];
				const parents = connections.get( parseInt( skeleton.ID ) ).parents;
				parents.forEach( function ( parent ) {
					if ( geometryMap.has( parent.ID ) ) {
						const geoID = parent.ID;
						const geoRelationships = connections.get( geoID );
						geoRelationships.parents.forEach( function ( geoConnParent ) {
							if ( modelMap.has( geoConnParent.ID ) ) {
								const model = modelMap.get( geoConnParent.ID );
								model.bind( new THREE.Skeleton( skeleton.bones ), bindMatrices[ geoConnParent.ID ] );
							}
						} );
					}
				} );
			}
		}
		parsePoseNodes() {
			const bindMatrices = {};
			if ( 'Pose' in fbxTree.Objects ) {
				const BindPoseNode = fbxTree.Objects.Pose;
				for ( const nodeID in BindPoseNode ) {
					if ( BindPoseNode[ nodeID ].attrType === 'BindPose' ) {
						const poseNodes = BindPoseNode[ nodeID ].PoseNode;
						if ( Array.isArray( poseNodes ) ) {
							poseNodes.forEach( function ( poseNode ) {
								bindMatrices[ poseNode.Node ] = new THREE.Matrix4().fromArray( poseNode.Matrix.a );
							} );
						} else {
							bindMatrices[ poseNodes.Node ] = new THREE.Matrix4().fromArray( poseNodes.Matrix.a );
						}
					}
				}
			}
			return bindMatrices;
		}
		createAmbientLight() {
			if ( 'GlobalSettings' in fbxTree && 'AmbientColor' in fbxTree.GlobalSettings ) {
				const ambientColor = fbxTree.GlobalSettings.AmbientColor.value;
				const r = ambientColor[ 0 ];
				const g = ambientColor[ 1 ];
				const b = ambientColor[ 2 ];
				if ( r !== 0 || g !== 0 || b !== 0 ) {
					const color = new THREE.Color( r, g, b );
					sceneGraph.add( new THREE.AmbientLight( color, 1 ) );
				}
			}
		}
		setupMorphMaterials() {
			const scope = this;
			sceneGraph.traverse( function ( child ) {
				if ( child.isMesh ) {
					if ( child.geometry.morphAttributes.position && child.geometry.morphAttributes.position.length ) {
						if ( Array.isArray( child.material ) ) {
							child.material.forEach( function ( material, i ) {
								scope.setupMorphMaterial( child, material, i );
							} );
						} else {
							scope.setupMorphMaterial( child, child.material );
						}
					}
				}
			} );
		}
		setupMorphMaterial( child, material, index ) {
			const uuid = child.uuid;
			const matUuid = material.uuid;
			let sharedMat = false;
			sceneGraph.traverse( function ( node ) {
				if ( node.isMesh ) {
					if ( Array.isArray( node.material ) ) {
						node.material.forEach( function ( mat ) {
							if ( mat.uuid === matUuid && node.uuid !== uuid ) sharedMat = true;
						} );
					} else if ( node.material.uuid === matUuid && node.uuid !== uuid ) sharedMat = true;
				}
			} );
			if ( sharedMat === true ) {
				const clonedMat = material.clone();
				clonedMat.morphTargets = true;
				if ( index === undefined ) child.material = clonedMat; else child.material[ index ] = clonedMat;
			} else material.morphTargets = true;
		}
	}
	class GeometryParser {
		parse( deformers ) {
			const geometryMap = new Map();
			if ( 'Geometry' in fbxTree.Objects ) {
				const geoNodes = fbxTree.Objects.Geometry;
				for ( const nodeID in geoNodes ) {
					const relationships = connections.get( parseInt( nodeID ) );
					const geo = this.parseGeometry( relationships, geoNodes[ nodeID ], deformers );
					geometryMap.set( parseInt( nodeID ), geo );
				}
			}
			return geometryMap;
		}
		parseGeometry( relationships, geoNode, deformers ) {
			switch ( geoNode.attrType ) {
				case 'Mesh':
					return this.parseMeshGeometry( relationships, geoNode, deformers );
					break;
				case 'NurbsCurve':
					return this.parseNurbsGeometry( geoNode );
					break;
			}
		}
		parseMeshGeometry( relationships, geoNode, deformers ) {
			const skeletons = deformers.skeletons;
			const morphTargets = [];
			const modelNodes = relationships.parents.map( function ( parent ) {
				return fbxTree.Objects.Model[ parent.ID ];
			} );
			if ( modelNodes.length === 0 ) return;
			const skeleton = relationships.children.reduce( function ( skeleton, child ) {
				if ( skeletons[ child.ID ] !== undefined ) skeleton = skeletons[ child.ID ];
				return skeleton;
			}, null );
			relationships.children.forEach( function ( child ) {
				if ( deformers.morphTargets[ child.ID ] !== undefined ) {
					morphTargets.push( deformers.morphTargets[ child.ID ] );
				}
			} );
			const modelNode = modelNodes[ 0 ];
			const transformData = {};
			if ( 'RotationOrder' in modelNode ) transformData.eulerOrder = getEulerOrder( modelNode.RotationOrder.value );
			if ( 'InheritType' in modelNode ) transformData.inheritType = parseInt( modelNode.InheritType.value );
			if ( 'GeometricTranslation' in modelNode ) transformData.translation = modelNode.GeometricTranslation.value;
			if ( 'GeometricRotation' in modelNode ) transformData.rotation = modelNode.GeometricRotation.value;
			if ( 'GeometricScaling' in modelNode ) transformData.scale = modelNode.GeometricScaling.value;
			const transform = generateTransform( transformData );
			return this.genGeometry( geoNode, skeleton, morphTargets, transform );
		}
		genGeometry( geoNode, skeleton, morphTargets, preTransform ) {
			const geo = new THREE.BufferGeometry();
			if ( geoNode.attrName ) geo.name = geoNode.attrName;
			const geoInfo = this.parseGeoNode( geoNode, skeleton );
			const buffers = this.genBuffers( geoInfo );
			const positionAttribute = new THREE.Float32BufferAttribute( buffers.vertex, 3 );
			positionAttribute.applyMatrix4( preTransform );
			geo.setAttribute( 'position', positionAttribute );
			if ( buffers.colors.length > 0 ) {
				geo.setAttribute( 'color', new THREE.Float32BufferAttribute( buffers.colors, 3 ) );
			}
			if ( skeleton ) {
				geo.setAttribute( 'skinIndex', new THREE.Uint16BufferAttribute( buffers.weightsIndices, 4 ) );
				geo.setAttribute( 'skinWeight', new THREE.Float32BufferAttribute( buffers.vertexWeights, 4 ) );
				geo.FBX_Deformer = skeleton;
			}
			if ( buffers.normal.length > 0 ) {
				const normalMatrix = new THREE.Matrix3().getNormalMatrix( preTransform );
				const normalAttribute = new THREE.Float32BufferAttribute( buffers.normal, 3 );
				normalAttribute.applyNormalMatrix( normalMatrix );
				geo.setAttribute( 'normal', normalAttribute );
			}
			buffers.uvs.forEach( function ( uvBuffer, i ) {
				let name = 'uv' + ( i + 1 ).toString();
				if ( i === 0 ) {
					name = 'uv';
				}
				geo.setAttribute( name, new THREE.Float32BufferAttribute( buffers.uvs[ i ], 2 ) );
			} );
			if ( geoInfo.material && geoInfo.material.mappingType !== 'AllSame' ) {
				let prevMaterialIndex = buffers.materialIndex[ 0 ];
				let startIndex = 0;
				buffers.materialIndex.forEach( function ( currentIndex, i ) {
					if ( currentIndex !== prevMaterialIndex ) {
						geo.addGroup( startIndex, i - startIndex, prevMaterialIndex );
						prevMaterialIndex = currentIndex;
						startIndex = i;
					}
				} );
				if ( geo.groups.length > 0 ) {
					const lastGroup = geo.groups[ geo.groups.length - 1 ];
					const lastIndex = lastGroup.start + lastGroup.count;
					if ( lastIndex !== buffers.materialIndex.length ) {
						geo.addGroup( lastIndex, buffers.materialIndex.length - lastIndex, prevMaterialIndex );
					}
				}
				if ( geo.groups.length === 0 ) {
					geo.addGroup( 0, buffers.materialIndex.length, buffers.materialIndex[ 0 ] );
				}
			}
			this.addMorphTargets( geo, geoNode, morphTargets, preTransform );
			return geo;
		}
		parseGeoNode( geoNode, skeleton ) {
			const geoInfo = {};
			geoInfo.vertexPositions = geoNode.Vertices !== undefined ? geoNode.Vertices.a : [];
			geoInfo.vertexIndices = geoNode.PolygonVertexIndex !== undefined ? geoNode.PolygonVertexIndex.a : [];
			if ( geoNode.LayerElementColor ) {
				geoInfo.color = this.parseVertexColors( geoNode.LayerElementColor[ 0 ] );
			}
			if ( geoNode.LayerElementMaterial ) {
				geoInfo.material = this.parseMaterialIndices( geoNode.LayerElementMaterial[ 0 ] );
			}
			if ( geoNode.LayerElementNormal ) {
				geoInfo.normal = this.parseNormals( geoNode.LayerElementNormal[ 0 ] );
			}
			if ( geoNode.LayerElementUV ) {
				geoInfo.uv = [];
				let i = 0;
				while ( geoNode.LayerElementUV[ i ] ) {
					if ( geoNode.LayerElementUV[ i ].UV ) {
						geoInfo.uv.push( this.parseUVs( geoNode.LayerElementUV[ i ] ) );
					}
					i ++;
				}
			}
			geoInfo.weightTable = {};
			if ( skeleton !== null ) {
				geoInfo.skeleton = skeleton;
				skeleton.rawBones.forEach( function ( rawBone, i ) {
					rawBone.indices.forEach( function ( index, j ) {
						if ( geoInfo.weightTable[ index ] === undefined ) geoInfo.weightTable[ index ] = [];
						geoInfo.weightTable[ index ].push( {
							id: i,
							weight: rawBone.weights[ j ]
						} );
					} );
				} );
			}
			return geoInfo;
		}
		genBuffers( geoInfo ) {
			const buffers = {
				vertex: [],
				normal: [],
				colors: [],
				uvs: [],
				materialIndex: [],
				vertexWeights: [],
				weightsIndices: []
			};
			let polygonIndex = 0;
			let faceLength = 0;
			let displayedWeightsWarning = false;
			let facePositionIndexes = [];
			let faceNormals = [];
			let faceColors = [];
			let faceUVs = [];
			let faceWeights = [];
			let faceWeightIndices = [];
			const scope = this;
			geoInfo.vertexIndices.forEach( function ( vertexIndex, polygonVertexIndex ) {
				let materialIndex;
				let endOfFace = false;
				if ( vertexIndex < 0 ) {
					vertexIndex = vertexIndex ^ - 1;
					endOfFace = true;
				}
				let weightIndices = [];
				let weights = [];
				facePositionIndexes.push( vertexIndex * 3, vertexIndex * 3 + 1, vertexIndex * 3 + 2 );
				if ( geoInfo.color ) {
					const data = getData( polygonVertexIndex, polygonIndex, vertexIndex, geoInfo.color );
					faceColors.push( data[ 0 ], data[ 1 ], data[ 2 ] );
				}
				if ( geoInfo.skeleton ) {
					if ( geoInfo.weightTable[ vertexIndex ] !== undefined ) {
						geoInfo.weightTable[ vertexIndex ].forEach( function ( wt ) {
							weights.push( wt.weight );
							weightIndices.push( wt.id );
						} );
					}
					if ( weights.length > 4 ) {
						if ( ! displayedWeightsWarning ) {
							console.warn( 'THREE.FBXLoader: Vertex has more than 4 skinning weights assigned to vertex. Deleting additional weights.' );
							displayedWeightsWarning = true;
						}
						const wIndex = [ 0, 0, 0, 0 ];
						const Weight = [ 0, 0, 0, 0 ];
						weights.forEach( function ( weight, weightIndex ) {
							let currentWeight = weight;
							let currentIndex = weightIndices[ weightIndex ];
							Weight.forEach( function ( comparedWeight, comparedWeightIndex, comparedWeightArray ) {
								if ( currentWeight > comparedWeight ) {
									comparedWeightArray[ comparedWeightIndex ] = currentWeight;
									currentWeight = comparedWeight;
									const tmp = wIndex[ comparedWeightIndex ];
									wIndex[ comparedWeightIndex ] = currentIndex;
									currentIndex = tmp;
								}
							} );
						} );
						weightIndices = wIndex;
						weights = Weight;
					}
					while ( weights.length < 4 ) {
						weights.push( 0 );
						weightIndices.push( 0 );
					}
					for ( let i = 0; i < 4; ++ i ) {
						faceWeights.push( weights[ i ] );
						faceWeightIndices.push( weightIndices[ i ] );
					}
				}
				if ( geoInfo.normal ) {
					const data = getData( polygonVertexIndex, polygonIndex, vertexIndex, geoInfo.normal );
					faceNormals.push( data[ 0 ], data[ 1 ], data[ 2 ] );
				}
				if ( geoInfo.material && geoInfo.material.mappingType !== 'AllSame' ) {
					materialIndex = getData( polygonVertexIndex, polygonIndex, vertexIndex, geoInfo.material )[ 0 ];
				}
				if ( geoInfo.uv ) {
					geoInfo.uv.forEach( function ( uv, i ) {
						const data = getData( polygonVertexIndex, polygonIndex, vertexIndex, uv );
						if ( faceUVs[ i ] === undefined ) {
							faceUVs[ i ] = [];
						}
						faceUVs[ i ].push( data[ 0 ] );
						faceUVs[ i ].push( data[ 1 ] );
					} );
				}
				faceLength ++;
				if ( endOfFace ) {
					scope.genFace( buffers, geoInfo, facePositionIndexes, materialIndex, faceNormals, faceColors, faceUVs, faceWeights, faceWeightIndices, faceLength );
					polygonIndex ++;
					faceLength = 0;
					facePositionIndexes = [];
					faceNormals = [];
					faceColors = [];
					faceUVs = [];
					faceWeights = [];
					faceWeightIndices = [];
				}
			} );
			return buffers;
		}
		genFace( buffers, geoInfo, facePositionIndexes, materialIndex, faceNormals, faceColors, faceUVs, faceWeights, faceWeightIndices, faceLength ) {
			for ( let i = 2; i < faceLength; i ++ ) {
				buffers.vertex.push( geoInfo.vertexPositions[ facePositionIndexes[ 0 ] ] );
				buffers.vertex.push( geoInfo.vertexPositions[ facePositionIndexes[ 1 ] ] );
				buffers.vertex.push( geoInfo.vertexPositions[ facePositionIndexes[ 2 ] ] );
				buffers.vertex.push( geoInfo.vertexPositions[ facePositionIndexes[ ( i - 1 ) * 3 ] ] );
				buffers.vertex.push( geoInfo.vertexPositions[ facePositionIndexes[ ( i - 1 ) * 3 + 1 ] ] );
				buffers.vertex.push( geoInfo.vertexPositions[ facePositionIndexes[ ( i - 1 ) * 3 + 2 ] ] );
				buffers.vertex.push( geoInfo.vertexPositions[ facePositionIndexes[ i * 3 ] ] );
				buffers.vertex.push( geoInfo.vertexPositions[ facePositionIndexes[ i * 3 + 1 ] ] );
				buffers.vertex.push( geoInfo.vertexPositions[ facePositionIndexes[ i * 3 + 2 ] ] );
				if ( geoInfo.skeleton ) {
					buffers.vertexWeights.push( faceWeights[ 0 ] );
					buffers.vertexWeights.push( faceWeights[ 1 ] );
					buffers.vertexWeights.push( faceWeights[ 2 ] );
					buffers.vertexWeights.push( faceWeights[ 3 ] );
					buffers.vertexWeights.push( faceWeights[ ( i - 1 ) * 4 ] );
					buffers.vertexWeights.push( faceWeights[ ( i - 1 ) * 4 + 1 ] );
					buffers.vertexWeights.push( faceWeights[ ( i - 1 ) * 4 + 2 ] );
					buffers.vertexWeights.push( faceWeights[ ( i - 1 ) * 4 + 3 ] );
					buffers.vertexWeights.push( faceWeights[ i * 4 ] );
					buffers.vertexWeights.push( faceWeights[ i * 4 + 1 ] );
					buffers.vertexWeights.push( faceWeights[ i * 4 + 2 ] );
					buffers.vertexWeights.push( faceWeights[ i * 4 + 3 ] );
					buffers.weightsIndices.push( faceWeightIndices[ 0 ] );
					buffers.weightsIndices.push( faceWeightIndices[ 1 ] );
					buffers.weightsIndices.push( faceWeightIndices[ 2 ] );
					buffers.weightsIndices.push( faceWeightIndices[ 3 ] );
					buffers.weightsIndices.push( faceWeightIndices[ ( i - 1 ) * 4 ] );
					buffers.weightsIndices.push( faceWeightIndices[ ( i - 1 ) * 4 + 1 ] );
					buffers.weightsIndices.push( faceWeightIndices[ ( i - 1 ) * 4 + 2 ] );
					buffers.weightsIndices.push( faceWeightIndices[ ( i - 1 ) * 4 + 3 ] );
					buffers.weightsIndices.push( faceWeightIndices[ i * 4 ] );
					buffers.weightsIndices.push( faceWeightIndices[ i * 4 + 1 ] );
					buffers.weightsIndices.push( faceWeightIndices[ i * 4 + 2 ] );
					buffers.weightsIndices.push( faceWeightIndices[ i * 4 + 3 ] );
				}
				if ( geoInfo.color ) {
					buffers.colors.push( faceColors[ 0 ] );
					buffers.colors.push( faceColors[ 1 ] );
					buffers.colors.push( faceColors[ 2 ] );
					buffers.colors.push( faceColors[ ( i - 1 ) * 3 ] );
					buffers.colors.push( faceColors[ ( i - 1 ) * 3 + 1 ] );
					buffers.colors.push( faceColors[ ( i - 1 ) * 3 + 2 ] );
					buffers.colors.push( faceColors[ i * 3 ] );
					buffers.colors.push( faceColors[ i * 3 + 1 ] );
					buffers.colors.push( faceColors[ i * 3 + 2 ] );
				}
				if ( geoInfo.material && geoInfo.material.mappingType !== 'AllSame' ) {
					buffers.materialIndex.push( materialIndex );
					buffers.materialIndex.push( materialIndex );
					buffers.materialIndex.push( materialIndex );
				}
				if ( geoInfo.normal ) {
					buffers.normal.push( faceNormals[ 0 ] );
					buffers.normal.push( faceNormals[ 1 ] );
					buffers.normal.push( faceNormals[ 2 ] );
					buffers.normal.push( faceNormals[ ( i - 1 ) * 3 ] );
					buffers.normal.push( faceNormals[ ( i - 1 ) * 3 + 1 ] );
					buffers.normal.push( faceNormals[ ( i - 1 ) * 3 + 2 ] );
					buffers.normal.push( faceNormals[ i * 3 ] );
					buffers.normal.push( faceNormals[ i * 3 + 1 ] );
					buffers.normal.push( faceNormals[ i * 3 + 2 ] );
				}
				if ( geoInfo.uv ) {
					geoInfo.uv.forEach( function ( uv, j ) {
						if ( buffers.uvs[ j ] === undefined ) buffers.uvs[ j ] = [];
						buffers.uvs[ j ].push( faceUVs[ j ][ 0 ] );
						buffers.uvs[ j ].push( faceUVs[ j ][ 1 ] );
						buffers.uvs[ j ].push( faceUVs[ j ][ ( i - 1 ) * 2 ] );
						buffers.uvs[ j ].push( faceUVs[ j ][ ( i - 1 ) * 2 + 1 ] );
						buffers.uvs[ j ].push( faceUVs[ j ][ i * 2 ] );
						buffers.uvs[ j ].push( faceUVs[ j ][ i * 2 + 1 ] );
					} );
				}
			}
		}
		addMorphTargets( parentGeo, parentGeoNode, morphTargets, preTransform ) {
			if ( morphTargets.length === 0 ) return;
			parentGeo.morphTargetsRelative = true;
			parentGeo.morphAttributes.position = [];
			const scope = this;
			morphTargets.forEach( function ( morphTarget ) {
				morphTarget.rawTargets.forEach( function ( rawTarget ) {
					const morphGeoNode = fbxTree.Objects.Geometry[ rawTarget.geoID ];
					if ( morphGeoNode !== undefined ) {
						scope.genMorphGeometry( parentGeo, parentGeoNode, morphGeoNode, preTransform, rawTarget.name );
					}
				} );
			} );
		}
		genMorphGeometry( parentGeo, parentGeoNode, morphGeoNode, preTransform, name ) {
			const vertexIndices = parentGeoNode.PolygonVertexIndex !== undefined ? parentGeoNode.PolygonVertexIndex.a : [];
			const morphPositionsSparse = morphGeoNode.Vertices !== undefined ? morphGeoNode.Vertices.a : [];
			const indices = morphGeoNode.Indexes !== undefined ? morphGeoNode.Indexes.a : [];
			const length = parentGeo.attributes.position.count * 3;
			const morphPositions = new Float32Array( length );
			for ( let i = 0; i < indices.length; i ++ ) {
				const morphIndex = indices[ i ] * 3;
				morphPositions[ morphIndex ] = morphPositionsSparse[ i * 3 ];
				morphPositions[ morphIndex + 1 ] = morphPositionsSparse[ i * 3 + 1 ];
				morphPositions[ morphIndex + 2 ] = morphPositionsSparse[ i * 3 + 2 ];
			}
			const morphGeoInfo = {
				vertexIndices: vertexIndices,
				vertexPositions: morphPositions
			};
			const morphBuffers = this.genBuffers( morphGeoInfo );
			const positionAttribute = new THREE.Float32BufferAttribute( morphBuffers.vertex, 3 );
			positionAttribute.name = name || morphGeoNode.attrName;
			positionAttribute.applyMatrix4( preTransform );
			parentGeo.morphAttributes.position.push( positionAttribute );
		}
		parseNormals( NormalNode ) {
			const mappingType = NormalNode.MappingInformationType;
			const referenceType = NormalNode.ReferenceInformationType;
			const buffer = NormalNode.Normals.a;
			let indexBuffer = [];
			if ( referenceType === 'IndexToDirect' ) {
				if ( 'NormalIndex' in NormalNode ) {
					indexBuffer = NormalNode.NormalIndex.a;
				} else if ( 'NormalsIndex' in NormalNode ) {
					indexBuffer = NormalNode.NormalsIndex.a;
				}
			}
			return {
				dataSize: 3,
				buffer: buffer,
				indices: indexBuffer,
				mappingType: mappingType,
				referenceType: referenceType
			};
		}
		parseUVs( UVNode ) {
			const mappingType = UVNode.MappingInformationType;
			const referenceType = UVNode.ReferenceInformationType;
			const buffer = UVNode.UV.a;
			let indexBuffer = [];
			if ( referenceType === 'IndexToDirect' ) {
				indexBuffer = UVNode.UVIndex.a;
			}
			return {
				dataSize: 2,
				buffer: buffer,
				indices: indexBuffer,
				mappingType: mappingType,
				referenceType: referenceType
			};
		}
		parseVertexColors( ColorNode ) {
			const mappingType = ColorNode.MappingInformationType;
			const referenceType = ColorNode.ReferenceInformationType;
			const buffer = ColorNode.Colors.a;
			let indexBuffer = [];
			if ( referenceType === 'IndexToDirect' ) {
				indexBuffer = ColorNode.ColorIndex.a;
			}
			return {
				dataSize: 4,
				buffer: buffer,
				indices: indexBuffer,
				mappingType: mappingType,
				referenceType: referenceType
			};
		}
		parseMaterialIndices( MaterialNode ) {
			const mappingType = MaterialNode.MappingInformationType;
			const referenceType = MaterialNode.ReferenceInformationType;
			if ( mappingType === 'NoMappingInformation' ) {
				return {
					dataSize: 1,
					buffer: [ 0 ],
					indices: [ 0 ],
					mappingType: 'AllSame',
					referenceType: referenceType
				};
			}
			const materialIndexBuffer = MaterialNode.Materials.a;
			const materialIndices = [];
			for ( let i = 0; i < materialIndexBuffer.length; ++ i ) {
				materialIndices.push( i );
			}
			return {
				dataSize: 1,
				buffer: materialIndexBuffer,
				indices: materialIndices,
				mappingType: mappingType,
				referenceType: referenceType
			};
		}
		parseNurbsGeometry( geoNode ) {
			if ( THREE.NURBSCurve === undefined ) {
				console.error( 'THREE.FBXLoader: The loader relies on THREE.NURBSCurve for any nurbs present in the model. Nurbs will show up as empty geometry.' );
				return new THREE.BufferGeometry();
			}
			const order = parseInt( geoNode.Order );
			if ( isNaN( order ) ) {
				console.error( 'THREE.FBXLoader: Invalid Order %s given for geometry ID: %s', geoNode.Order, geoNode.id );
				return new THREE.BufferGeometry();
			}
			const degree = order - 1;
			const knots = geoNode.KnotVector.a;
			const controlPoints = [];
			const pointsValues = geoNode.Points.a;
			for ( let i = 0, l = pointsValues.length; i < l; i += 4 ) {
				controlPoints.push( new THREE.Vector4().fromArray( pointsValues, i ) );
			}
			let startKnot, endKnot;
			if ( geoNode.Form === 'Closed' ) {
				controlPoints.push( controlPoints[ 0 ] );
			} else if ( geoNode.Form === 'Periodic' ) {
				startKnot = degree;
				endKnot = knots.length - 1 - startKnot;
				for ( let i = 0; i < degree; ++ i ) {
					controlPoints.push( controlPoints[ i ] );
				}
			}
			const curve = new THREE.NURBSCurve( degree, knots, controlPoints, startKnot, endKnot );
			const vertices = curve.getPoints( controlPoints.length * 7 );
			const positions = new Float32Array( vertices.length * 3 );
			vertices.forEach( function ( vertex, i ) {
				vertex.toArray( positions, i * 3 );
			} );
			const geometry = new THREE.BufferGeometry();
			geometry.setAttribute( 'position', new THREE.BufferAttribute( positions, 3 ) );
			return geometry;
		}
	}
	class AnimationParser {
		parse() {
			const animationClips = [];
			const rawClips = this.parseClips();
			if ( rawClips !== undefined ) {
				for ( const key in rawClips ) {
					const rawClip = rawClips[ key ];
					const clip = this.addClip( rawClip );
					animationClips.push( clip );
				}
			}
			return animationClips;
		}
		parseClips() {
			if ( fbxTree.Objects.AnimationCurve === undefined ) return undefined;
			const curveNodesMap = this.parseAnimationCurveNodes();
			this.parseAnimationCurves( curveNodesMap );
			const layersMap = this.parseAnimationLayers( curveNodesMap );
			const rawClips = this.parseAnimStacks( layersMap );
			return rawClips;
		}
		parseAnimationCurveNodes() {
			const rawCurveNodes = fbxTree.Objects.AnimationCurveNode;
			const curveNodesMap = new Map();
			for ( const nodeID in rawCurveNodes ) {
				const rawCurveNode = rawCurveNodes[ nodeID ];
				if ( rawCurveNode.attrName.match( /S|R|T|DeformPercent/ ) !== null ) {
					const curveNode = {
						id: rawCurveNode.id,
						attr: rawCurveNode.attrName,
						curves: {}
					};
					curveNodesMap.set( curveNode.id, curveNode );
				}
			}
			return curveNodesMap;
		}
		parseAnimationCurves( curveNodesMap ) {
			const rawCurves = fbxTree.Objects.AnimationCurve;
			for ( const nodeID in rawCurves ) {
				const animationCurve = {
					id: rawCurves[ nodeID ].id,
					times: rawCurves[ nodeID ].KeyTime.a.map( convertFBXTimeToSeconds ),
					values: rawCurves[ nodeID ].KeyValueFloat.a
				};
				const relationships = connections.get( animationCurve.id );
				if ( relationships !== undefined ) {
					const animationCurveID = relationships.parents[ 0 ].ID;
					const animationCurveRelationship = relationships.parents[ 0 ].relationship;
					if ( animationCurveRelationship.match( /X/ ) ) {
						curveNodesMap.get( animationCurveID ).curves[ 'x' ] = animationCurve;
					} else if ( animationCurveRelationship.match( /Y/ ) ) {
						curveNodesMap.get( animationCurveID ).curves[ 'y' ] = animationCurve;
					} else if ( animationCurveRelationship.match( /Z/ ) ) {
						curveNodesMap.get( animationCurveID ).curves[ 'z' ] = animationCurve;
					} else if ( animationCurveRelationship.match( /d|DeformPercent/ ) && curveNodesMap.has( animationCurveID ) ) {
						curveNodesMap.get( animationCurveID ).curves[ 'morph' ] = animationCurve;
					}
				}
			}
		}
		parseAnimationLayers( curveNodesMap ) {
			const rawLayers = fbxTree.Objects.AnimationLayer;
			const layersMap = new Map();
			for ( const nodeID in rawLayers ) {
				const layerCurveNodes = [];
				const connection = connections.get( parseInt( nodeID ) );
				if ( connection !== undefined ) {
					const children = connection.children;
					children.forEach( function ( child, i ) {
						if ( curveNodesMap.has( child.ID ) ) {
							const curveNode = curveNodesMap.get( child.ID );
							if ( curveNode.curves.x !== undefined || curveNode.curves.y !== undefined || curveNode.curves.z !== undefined ) {
								if ( layerCurveNodes[ i ] === undefined ) {
									const modelID = connections.get( child.ID ).parents.filter( function ( parent ) {
										return parent.relationship !== undefined;
									} )[ 0 ].ID;
									if ( modelID !== undefined ) {
										const rawModel = fbxTree.Objects.Model[ modelID.toString() ];
										if ( rawModel === undefined ) {
											console.warn( 'THREE.FBXLoader: Encountered a unused curve.', child );
											return;
										}
										const node = {
											modelName: rawModel.attrName ? THREE.PropertyBinding.sanitizeNodeName( rawModel.attrName ) : '',
											ID: rawModel.id,
											initialPosition: [ 0, 0, 0 ],
											initialRotation: [ 0, 0, 0 ],
											initialScale: [ 1, 1, 1 ]
										};
										sceneGraph.traverse( function ( child ) {
											if ( child.ID === rawModel.id ) {
												node.transform = child.matrix;
												if ( child.userData.transformData ) node.eulerOrder = child.userData.transformData.eulerOrder;
											}
										} );
										if ( ! node.transform ) node.transform = new THREE.Matrix4();
										if ( 'PreRotation' in rawModel ) node.preRotation = rawModel.PreRotation.value;
										if ( 'PostRotation' in rawModel ) node.postRotation = rawModel.PostRotation.value;
										layerCurveNodes[ i ] = node;
									}
								}
								if ( layerCurveNodes[ i ] ) layerCurveNodes[ i ][ curveNode.attr ] = curveNode;
							} else if ( curveNode.curves.morph !== undefined ) {
								if ( layerCurveNodes[ i ] === undefined ) {
									const deformerID = connections.get( child.ID ).parents.filter( function ( parent ) {
										return parent.relationship !== undefined;
									} )[ 0 ].ID;
									const morpherID = connections.get( deformerID ).parents[ 0 ].ID;
									const geoID = connections.get( morpherID ).parents[ 0 ].ID;
									const modelID = connections.get( geoID ).parents[ 0 ].ID;
									const rawModel = fbxTree.Objects.Model[ modelID ];
									const node = {
										modelName: rawModel.attrName ? THREE.PropertyBinding.sanitizeNodeName( rawModel.attrName ) : '',
										morphName: fbxTree.Objects.Deformer[ deformerID ].attrName
									};
									layerCurveNodes[ i ] = node;
								}
								layerCurveNodes[ i ][ curveNode.attr ] = curveNode;
							}
						}
					} );
					layersMap.set( parseInt( nodeID ), layerCurveNodes );
				}
			}
			return layersMap;
		}
		parseAnimStacks( layersMap ) {
			const rawStacks = fbxTree.Objects.AnimationStack;
			const rawClips = {};
			for ( const nodeID in rawStacks ) {
				const children = connections.get( parseInt( nodeID ) ).children;
				if ( children.length > 1 ) {
					console.warn( 'THREE.FBXLoader: Encountered an animation stack with multiple layers, this is currently not supported. Ignoring subsequent layers.' );
				}
				const layer = layersMap.get( children[ 0 ].ID );
				rawClips[ nodeID ] = {
					name: rawStacks[ nodeID ].attrName,
					layer: layer
				};
			}
			return rawClips;
		}
		addClip( rawClip ) {
			let tracks = [];
			const scope = this;
			rawClip.layer.forEach( function ( rawTracks ) {
				tracks = tracks.concat( scope.generateTracks( rawTracks ) );
			} );
			return new THREE.AnimationClip( rawClip.name, - 1, tracks );
		}
		generateTracks( rawTracks ) {
			const tracks = [];
			let initialPosition = new THREE.Vector3();
			let initialRotation = new THREE.Quaternion();
			let initialScale = new THREE.Vector3();
			if ( rawTracks.transform ) rawTracks.transform.decompose( initialPosition, initialRotation, initialScale );
			initialPosition = initialPosition.toArray();
			initialRotation = new THREE.Euler().setFromQuaternion( initialRotation, rawTracks.eulerOrder ).toArray();
			initialScale = initialScale.toArray();
			if ( rawTracks.T !== undefined && Object.keys( rawTracks.T.curves ).length > 0 ) {
				const positionTrack = this.generateVectorTrack( rawTracks.modelName, rawTracks.T.curves, initialPosition, 'position' );
				if ( positionTrack !== undefined ) tracks.push( positionTrack );
			}
			if ( rawTracks.R !== undefined && Object.keys( rawTracks.R.curves ).length > 0 ) {
				const rotationTrack = this.generateRotationTrack( rawTracks.modelName, rawTracks.R.curves, initialRotation, rawTracks.preRotation, rawTracks.postRotation, rawTracks.eulerOrder );
				if ( rotationTrack !== undefined ) tracks.push( rotationTrack );
			}
			if ( rawTracks.S !== undefined && Object.keys( rawTracks.S.curves ).length > 0 ) {
				const scaleTrack = this.generateVectorTrack( rawTracks.modelName, rawTracks.S.curves, initialScale, 'scale' );
				if ( scaleTrack !== undefined ) tracks.push( scaleTrack );
			}
			if ( rawTracks.DeformPercent !== undefined ) {
				const morphTrack = this.generateMorphTrack( rawTracks );
				if ( morphTrack !== undefined ) tracks.push( morphTrack );
			}
			return tracks;
		}
		generateVectorTrack( modelName, curves, initialValue, type ) {
			const times = this.getTimesForAllAxes( curves );
			const values = this.getKeyframeTrackValues( times, curves, initialValue );
			return new THREE.VectorKeyframeTrack( modelName + '.' + type, times, values );
		}
		generateRotationTrack( modelName, curves, initialValue, preRotation, postRotation, eulerOrder ) {
			if ( curves.x !== undefined ) {
				this.interpolateRotations( curves.x );
				curves.x.values = curves.x.values.map( THREE.MathUtils.degToRad );
			}
			if ( curves.y !== undefined ) {
				this.interpolateRotations( curves.y );
				curves.y.values = curves.y.values.map( THREE.MathUtils.degToRad );
			}
			if ( curves.z !== undefined ) {
				this.interpolateRotations( curves.z );
				curves.z.values = curves.z.values.map( THREE.MathUtils.degToRad );
			}
			const times = this.getTimesForAllAxes( curves );
			const values = this.getKeyframeTrackValues( times, curves, initialValue );
			if ( preRotation !== undefined ) {
				preRotation = preRotation.map( THREE.MathUtils.degToRad );
				preRotation.push( eulerOrder );
				preRotation = new THREE.Euler().fromArray( preRotation );
				preRotation = new THREE.Quaternion().setFromEuler( preRotation );
			}
			if ( postRotation !== undefined ) {
				postRotation = postRotation.map( THREE.MathUtils.degToRad );
				postRotation.push( eulerOrder );
				postRotation = new THREE.Euler().fromArray( postRotation );
				postRotation = new THREE.Quaternion().setFromEuler( postRotation ).invert();
			}
			const quaternion = new THREE.Quaternion();
			const euler = new THREE.Euler();
			const quaternionValues = [];
			for ( let i = 0; i < values.length; i += 3 ) {
				euler.set( values[ i ], values[ i + 1 ], values[ i + 2 ], eulerOrder );
				quaternion.setFromEuler( euler );
				if ( preRotation !== undefined ) quaternion.premultiply( preRotation );
				if ( postRotation !== undefined ) quaternion.multiply( postRotation );
				quaternion.toArray( quaternionValues, i / 3 * 4 );
			}
			return new THREE.QuaternionKeyframeTrack( modelName + '.quaternion', times, quaternionValues );
		}
		generateMorphTrack( rawTracks ) {
			const curves = rawTracks.DeformPercent.curves.morph;
			const values = curves.values.map( function ( val ) {
				return val / 100;
			} );
			const morphNum = sceneGraph.getObjectByName( rawTracks.modelName ).morphTargetDictionary[ rawTracks.morphName ];
			return new THREE.NumberKeyframeTrack( rawTracks.modelName + '.morphTargetInfluences[' + morphNum + ']', curves.times, values );
		}
		getTimesForAllAxes( curves ) {
			let times = [];
			if ( curves.x !== undefined ) times = times.concat( curves.x.times );
			if ( curves.y !== undefined ) times = times.concat( curves.y.times );
			if ( curves.z !== undefined ) times = times.concat( curves.z.times );
			times = times.sort( function ( a, b ) {
				return a - b;
			} );
			if ( times.length > 1 ) {
				let targetIndex = 1;
				let lastValue = times[ 0 ];
				for ( let i = 1; i < times.length; i ++ ) {
					const currentValue = times[ i ];
					if ( currentValue !== lastValue ) {
						times[ targetIndex ] = currentValue;
						lastValue = currentValue;
						targetIndex ++;
					}
				}
				times = times.slice( 0, targetIndex );
			}
			return times;
		}
		getKeyframeTrackValues( times, curves, initialValue ) {
			const prevValue = initialValue;
			const values = [];
			let xIndex = - 1;
			let yIndex = - 1;
			let zIndex = - 1;
			times.forEach( function ( time ) {
				if ( curves.x ) xIndex = curves.x.times.indexOf( time );
				if ( curves.y ) yIndex = curves.y.times.indexOf( time );
				if ( curves.z ) zIndex = curves.z.times.indexOf( time );
				if ( xIndex !== - 1 ) {
					const xValue = curves.x.values[ xIndex ];
					values.push( xValue );
					prevValue[ 0 ] = xValue;
				} else {
					values.push( prevValue[ 0 ] );
				}
				if ( yIndex !== - 1 ) {
					const yValue = curves.y.values[ yIndex ];
					values.push( yValue );
					prevValue[ 1 ] = yValue;
				} else {
					values.push( prevValue[ 1 ] );
				}
				if ( zIndex !== - 1 ) {
					const zValue = curves.z.values[ zIndex ];
					values.push( zValue );
					prevValue[ 2 ] = zValue;
				} else {
					values.push( prevValue[ 2 ] );
				}
			} );
			return values;
		}
		interpolateRotations( curve ) {
			for ( let i = 1; i < curve.values.length; i ++ ) {
				const initialValue = curve.values[ i - 1 ];
				const valuesSpan = curve.values[ i ] - initialValue;
				const absoluteSpan = Math.abs( valuesSpan );
				if ( absoluteSpan >= 180 ) {
					const numSubIntervals = absoluteSpan / 180;
					const step = valuesSpan / numSubIntervals;
					let nextValue = initialValue + step;
					const initialTime = curve.times[ i - 1 ];
					const timeSpan = curve.times[ i ] - initialTime;
					const interval = timeSpan / numSubIntervals;
					let nextTime = initialTime + interval;
					const interpolatedTimes = [];
					const interpolatedValues = [];
					while ( nextTime < curve.times[ i ] ) {
						interpolatedTimes.push( nextTime );
						nextTime += interval;
						interpolatedValues.push( nextValue );
						nextValue += step;
					}
					curve.times = inject( curve.times, i, interpolatedTimes );
					curve.values = inject( curve.values, i, interpolatedValues );
				}
			}
		}
	}
	class TextParser {
		getPrevNode() {
			return this.nodeStack[ this.currentIndent - 2 ];
		}
		getCurrentNode() {
			return this.nodeStack[ this.currentIndent - 1 ];
		}
		getCurrentProp() {
			return this.currentProp;
		}
		pushStack( node ) {
			this.nodeStack.push( node );
			this.currentIndent += 1;
		}
		popStack() {
			this.nodeStack.pop();
			this.currentIndent -= 1;
		}
		setCurrentProp( val, name ) {
			this.currentProp = val;
			this.currentPropName = name;
		}
		parse( text ) {
			this.currentIndent = 0;
			this.allNodes = new FBXTree();
			this.nodeStack = [];
			this.currentProp = [];
			this.currentPropName = '';
			const scope = this;
			const split = text.split( /[\r\n]+/ );
			split.forEach( function ( line, i ) {
				const matchComment = line.match( /^[\s\t]*;/ );
				const matchEmpty = line.match( /^[\s\t]*$/ );
				if ( matchComment || matchEmpty ) return;
				const matchBeginning = line.match( '^\\t{' + scope.currentIndent + '}(\\w+):(.*){', '' );
				const matchProperty = line.match( '^\\t{' + scope.currentIndent + '}(\\w+):[\\s\\t\\r\\n](.*)' );
				const matchEnd = line.match( '^\\t{' + ( scope.currentIndent - 1 ) + '}}' );
				if ( matchBeginning ) {
					scope.parseNodeBegin( line, matchBeginning );
				} else if ( matchProperty ) {
					scope.parseNodeProperty( line, matchProperty, split[ ++ i ] );
				} else if ( matchEnd ) {
					scope.popStack();
				} else if ( line.match( /^[^\s\t}]/ ) ) {
					scope.parseNodePropertyContinued( line );
				}
			} );
			return this.allNodes;
		}
		parseNodeBegin( line, property ) {
			const nodeName = property[ 1 ].trim().replace( /^"/, '' ).replace( /"$/, '' );
			const nodeAttrs = property[ 2 ].split( ',' ).map( function ( attr ) {
				return attr.trim().replace( /^"/, '' ).replace( /"$/, '' );
			} );
			const node = {
				name: nodeName
			};
			const attrs = this.parseNodeAttr( nodeAttrs );
			const currentNode = this.getCurrentNode();
			if ( this.currentIndent === 0 ) {
				this.allNodes.add( nodeName, node );
			} else {
				if ( nodeName in currentNode ) {
					if ( nodeName === 'PoseNode' ) {
						currentNode.PoseNode.push( node );
					} else if ( currentNode[ nodeName ].id !== undefined ) {
						currentNode[ nodeName ] = {};
						currentNode[ nodeName ][ currentNode[ nodeName ].id ] = currentNode[ nodeName ];
					}
					if ( attrs.id !== '' ) currentNode[ nodeName ][ attrs.id ] = node;
				} else if ( typeof attrs.id === 'number' ) {
					currentNode[ nodeName ] = {};
					currentNode[ nodeName ][ attrs.id ] = node;
				} else if ( nodeName !== 'Properties70' ) {
					if ( nodeName === 'PoseNode' ) currentNode[ nodeName ] = [ node ]; else currentNode[ nodeName ] = node;
				}
			}
			if ( typeof attrs.id === 'number' ) node.id = attrs.id;
			if ( attrs.name !== '' ) node.attrName = attrs.name;
			if ( attrs.type !== '' ) node.attrType = attrs.type;
			this.pushStack( node );
		}
		parseNodeAttr( attrs ) {
			let id = attrs[ 0 ];
			if ( attrs[ 0 ] !== '' ) {
				id = parseInt( attrs[ 0 ] );
				if ( isNaN( id ) ) {
					id = attrs[ 0 ];
				}
			}
			let name = '',
				type = '';
			if ( attrs.length > 1 ) {
				name = attrs[ 1 ].replace( /^(\w+)::/, '' );
				type = attrs[ 2 ];
			}
			return {
				id: id,
				name: name,
				type: type
			};
		}
		parseNodeProperty( line, property, contentLine ) {
			let propName = property[ 1 ].replace( /^"/, '' ).replace( /"$/, '' ).trim();
			let propValue = property[ 2 ].replace( /^"/, '' ).replace( /"$/, '' ).trim();
			if ( propName === 'Content' && propValue === ',' ) {
				propValue = contentLine.replace( /"/g, '' ).replace( /,$/, '' ).trim();
			}
			const currentNode = this.getCurrentNode();
			const parentName = currentNode.name;
			if ( parentName === 'Properties70' ) {
				this.parseNodeSpecialProperty( line, propName, propValue );
				return;
			}
			if ( propName === 'C' ) {
				const connProps = propValue.split( ',' ).slice( 1 );
				const from = parseInt( connProps[ 0 ] );
				const to = parseInt( connProps[ 1 ] );
				let rest = propValue.split( ',' ).slice( 3 );
				rest = rest.map( function ( elem ) {
					return elem.trim().replace( /^"/, '' );
				} );
				propName = 'connections';
				propValue = [ from, to ];
				append( propValue, rest );
				if ( currentNode[ propName ] === undefined ) {
					currentNode[ propName ] = [];
				}
			}
			if ( propName === 'Node' ) currentNode.id = propValue;
			if ( propName in currentNode && Array.isArray( currentNode[ propName ] ) ) {
				currentNode[ propName ].push( propValue );
			} else {
				if ( propName !== 'a' ) currentNode[ propName ] = propValue; else currentNode.a = propValue;
			}
			this.setCurrentProp( currentNode, propName );
			if ( propName === 'a' && propValue.slice( - 1 ) !== ',' ) {
				currentNode.a = parseNumberArray( propValue );
			}
		}
		parseNodePropertyContinued( line ) {
			const currentNode = this.getCurrentNode();
			currentNode.a += line;
			if ( line.slice( - 1 ) !== ',' ) {
				currentNode.a = parseNumberArray( currentNode.a );
			}
		}
		parseNodeSpecialProperty( line, propName, propValue ) {
			const props = propValue.split( '",' ).map( function ( prop ) {
				return prop.trim().replace( /^\"/, '' ).replace( /\s/, '_' );
			} );
			const innerPropName = props[ 0 ];
			const innerPropType1 = props[ 1 ];
			const innerPropType2 = props[ 2 ];
			const innerPropFlag = props[ 3 ];
			let innerPropValue = props[ 4 ];
			switch ( innerPropType1 ) {
				case 'int':
				case 'enum':
				case 'bool':
				case 'ULongLong':
				case 'double':
				case 'Number':
				case 'FieldOfView':
					innerPropValue = parseFloat( innerPropValue );
					break;
				case 'Color':
				case 'ColorRGB':
				case 'Vector3D':
				case 'Lcl_Translation':
				case 'Lcl_Rotation':
				case 'Lcl_Scaling':
					innerPropValue = parseNumberArray( innerPropValue );
					break;
			}
			this.getPrevNode()[ innerPropName ] = {
				'type': innerPropType1,
				'type2': innerPropType2,
				'flag': innerPropFlag,
				'value': innerPropValue
			};
			this.setCurrentProp( this.getPrevNode(), innerPropName );
		}
	}
	class BinaryParser {
		parse( buffer ) {
			const reader = new BinaryReader( buffer );
			reader.skip( 23 );
			const version = reader.getUint32();
			if ( version < 6400 ) {
				throw new Error( 'THREE.FBXLoader: FBX version not supported, FileVersion: ' + version );
			}
			const allNodes = new FBXTree();
			while ( ! this.endOfContent( reader ) ) {
				const node = this.parseNode( reader, version );
				if ( node !== null ) allNodes.add( node.name, node );
			}
			return allNodes;
		}
		endOfContent( reader ) {
			if ( reader.size() % 16 === 0 ) {
				return ( reader.getOffset() + 160 + 16 & ~ 0xf ) >= reader.size();
			} else {
				return reader.getOffset() + 160 + 16 >= reader.size();
			}
		}
		parseNode( reader, version ) {
			const node = {};
			const endOffset = version >= 7500 ? reader.getUint64() : reader.getUint32();
			const numProperties = version >= 7500 ? reader.getUint64() : reader.getUint32();
			version >= 7500 ? reader.getUint64() : reader.getUint32();
			const nameLen = reader.getUint8();
			const name = reader.getString( nameLen );
			if ( endOffset === 0 ) return null;
			const propertyList = [];
			for ( let i = 0; i < numProperties; i ++ ) {
				propertyList.push( this.parseProperty( reader ) );
			}
			const id = propertyList.length > 0 ? propertyList[ 0 ] : '';
			const attrName = propertyList.length > 1 ? propertyList[ 1 ] : '';
			const attrType = propertyList.length > 2 ? propertyList[ 2 ] : '';
			node.singleProperty = numProperties === 1 && reader.getOffset() === endOffset ? true : false;
			while ( endOffset > reader.getOffset() ) {
				const subNode = this.parseNode( reader, version );
				if ( subNode !== null ) this.parseSubNode( name, node, subNode );
			}
			node.propertyList = propertyList;
			if ( typeof id === 'number' ) node.id = id;
			if ( attrName !== '' ) node.attrName = attrName;
			if ( attrType !== '' ) node.attrType = attrType;
			if ( name !== '' ) node.name = name;
			return node;
		}
		parseSubNode( name, node, subNode ) {
			if ( subNode.singleProperty === true ) {
				const value = subNode.propertyList[ 0 ];
				if ( Array.isArray( value ) ) {
					node[ subNode.name ] = subNode;
					subNode.a = value;
				} else {
					node[ subNode.name ] = value;
				}
			} else if ( name === 'Connections' && subNode.name === 'C' ) {
				const array = [];
				subNode.propertyList.forEach( function ( property, i ) {
					if ( i !== 0 ) array.push( property );
				} );
				if ( node.connections === undefined ) {
					node.connections = [];
				}
				node.connections.push( array );
			} else if ( subNode.name === 'Properties70' ) {
				const keys = Object.keys( subNode );
				keys.forEach( function ( key ) {
					node[ key ] = subNode[ key ];
				} );
			} else if ( name === 'Properties70' && subNode.name === 'P' ) {
				let innerPropName = subNode.propertyList[ 0 ];
				let innerPropType1 = subNode.propertyList[ 1 ];
				const innerPropType2 = subNode.propertyList[ 2 ];
				const innerPropFlag = subNode.propertyList[ 3 ];
				let innerPropValue;
				if ( innerPropName.indexOf( 'Lcl ' ) === 0 ) innerPropName = innerPropName.replace( 'Lcl ', 'Lcl_' );
				if ( innerPropType1.indexOf( 'Lcl ' ) === 0 ) innerPropType1 = innerPropType1.replace( 'Lcl ', 'Lcl_' );
				if ( innerPropType1 === 'Color' || innerPropType1 === 'ColorRGB' || innerPropType1 === 'Vector' || innerPropType1 === 'Vector3D' || innerPropType1.indexOf( 'Lcl_' ) === 0 ) {
					innerPropValue = [ subNode.propertyList[ 4 ], subNode.propertyList[ 5 ], subNode.propertyList[ 6 ] ];
				} else {
					innerPropValue = subNode.propertyList[ 4 ];
				}
				node[ innerPropName ] = {
					'type': innerPropType1,
					'type2': innerPropType2,
					'flag': innerPropFlag,
					'value': innerPropValue
				};
			} else if ( node[ subNode.name ] === undefined ) {
				if ( typeof subNode.id === 'number' ) {
					node[ subNode.name ] = {};
					node[ subNode.name ][ subNode.id ] = subNode;
				} else {
					node[ subNode.name ] = subNode;
				}
			} else {
				if ( subNode.name === 'PoseNode' ) {
					if ( ! Array.isArray( node[ subNode.name ] ) ) {
						node[ subNode.name ] = [ node[ subNode.name ] ];
					}
					node[ subNode.name ].push( subNode );
				} else if ( node[ subNode.name ][ subNode.id ] === undefined ) {
					node[ subNode.name ][ subNode.id ] = subNode;
				}
			}
		}
		parseProperty( reader ) {
			const type = reader.getString( 1 );
			let length;
			switch ( type ) {
				case 'C':
					return reader.getBoolean();
				case 'D':
					return reader.getFloat64();
				case 'F':
					return reader.getFloat32();
				case 'I':
					return reader.getInt32();
				case 'L':
					return reader.getInt64();
				case 'R':
					length = reader.getUint32();
					return reader.getArrayBuffer( length );
				case 'S':
					length = reader.getUint32();
					return reader.getString( length );
				case 'Y':
					return reader.getInt16();
				case 'b':
				case 'c':
				case 'd':
				case 'f':
				case 'i':
				case 'l':
					const arrayLength = reader.getUint32();
					const encoding = reader.getUint32();
					const compressedLength = reader.getUint32();
					if ( encoding === 0 ) {
						switch ( type ) {
							case 'b':
							case 'c':
								return reader.getBooleanArray( arrayLength );
							case 'd':
								return reader.getFloat64Array( arrayLength );
							case 'f':
								return reader.getFloat32Array( arrayLength );
							case 'i':
								return reader.getInt32Array( arrayLength );
							case 'l':
								return reader.getInt64Array( arrayLength );
						}
					}
					if ( typeof fflate === 'undefined' ) {
						console.error( 'THREE.FBXLoader: External library fflate.min.js required.' );
					}
					const data = fflate.unzlibSync( new Uint8Array( reader.getArrayBuffer( compressedLength ) ) );
					const reader2 = new BinaryReader( data.buffer );
					switch ( type ) {
						case 'b':
						case 'c':
							return reader2.getBooleanArray( arrayLength );
						case 'd':
							return reader2.getFloat64Array( arrayLength );
						case 'f':
							return reader2.getFloat32Array( arrayLength );
						case 'i':
							return reader2.getInt32Array( arrayLength );
						case 'l':
							return reader2.getInt64Array( arrayLength );
					}
				default:
					throw new Error( 'THREE.FBXLoader: Unknown property type ' + type );
			}
		}
	}
	class BinaryReader {
		constructor( buffer, littleEndian ) {
			this.dv = new DataView( buffer );
			this.offset = 0;
			this.littleEndian = littleEndian !== undefined ? littleEndian : true;
		}
		getOffset() {
			return this.offset;
		}
		size() {
			return this.dv.buffer.byteLength;
		}
		skip( length ) {
			this.offset += length;
		}
		getBoolean() {
			return ( this.getUint8() & 1 ) === 1;
		}
		getBooleanArray( size ) {
			const a = [];
			for ( let i = 0; i < size; i ++ ) {
				a.push( this.getBoolean() );
			}
			return a;
		}
		getUint8() {
			const value = this.dv.getUint8( this.offset );
			this.offset += 1;
			return value;
		}
		getInt16() {
			const value = this.dv.getInt16( this.offset, this.littleEndian );
			this.offset += 2;
			return value;
		}
		getInt32() {
			const value = this.dv.getInt32( this.offset, this.littleEndian );
			this.offset += 4;
			return value;
		}
		getInt32Array( size ) {
			const a = [];
			for ( let i = 0; i < size; i ++ ) {
				a.push( this.getInt32() );
			}
			return a;
		}
		getUint32() {
			const value = this.dv.getUint32( this.offset, this.littleEndian );
			this.offset += 4;
			return value;
		}
		getInt64() {
			let low, high;
			if ( this.littleEndian ) {
				low = this.getUint32();
				high = this.getUint32();
			} else {
				high = this.getUint32();
				low = this.getUint32();
			}
			if ( high & 0x80000000 ) {
				high = ~ high & 0xFFFFFFFF;
				low = ~ low & 0xFFFFFFFF;
				if ( low === 0xFFFFFFFF ) high = high + 1 & 0xFFFFFFFF;
				low = low + 1 & 0xFFFFFFFF;
				return - ( high * 0x100000000 + low );
			}
			return high * 0x100000000 + low;
		}
		getInt64Array( size ) {
			const a = [];
			for ( let i = 0; i < size; i ++ ) {
				a.push( this.getInt64() );
			}
			return a;
		}
		getUint64() {
			let low, high;
			if ( this.littleEndian ) {
				low = this.getUint32();
				high = this.getUint32();
			} else {
				high = this.getUint32();
				low = this.getUint32();
			}
			return high * 0x100000000 + low;
		}
		getFloat32() {
			const value = this.dv.getFloat32( this.offset, this.littleEndian );
			this.offset += 4;
			return value;
		}
		getFloat32Array( size ) {
			const a = [];
			for ( let i = 0; i < size; i ++ ) {
				a.push( this.getFloat32() );
			}
			return a;
		}
		getFloat64() {
			const value = this.dv.getFloat64( this.offset, this.littleEndian );
			this.offset += 8;
			return value;
		}
		getFloat64Array( size ) {
			const a = [];
			for ( let i = 0; i < size; i ++ ) {
				a.push( this.getFloat64() );
			}
			return a;
		}
		getArrayBuffer( size ) {
			const value = this.dv.buffer.slice( this.offset, this.offset + size );
			this.offset += size;
			return value;
		}
		getString( size ) {
			let a = [];
			for ( let i = 0; i < size; i ++ ) {
				a[ i ] = this.getUint8();
			}
			const nullByte = a.indexOf( 0 );
			if ( nullByte >= 0 ) a = a.slice( 0, nullByte );
			return THREE.LoaderUtils.decodeText( new Uint8Array( a ) );
		}
	}
	class FBXTree {
		add( key, val ) {
			this[ key ] = val;
		}
	}
	function isFbxFormatBinary( buffer ) {
		const CORRECT = 'Kaydara\u0020FBX\u0020Binary\u0020\u0020\0';
		return buffer.byteLength >= CORRECT.length && CORRECT === convertArrayBufferToString( buffer, 0, CORRECT.length );
	}
	function isFbxFormatASCII( text ) {
		const CORRECT = [ 'K', 'a', 'y', 'd', 'a', 'r', 'a', '\\', 'F', 'B', 'X', '\\', 'B', 'i', 'n', 'a', 'r', 'y', '\\', '\\' ];
		let cursor = 0;
		function read( offset ) {
			const result = text[ offset - 1 ];
			text = text.slice( cursor + offset );
			cursor ++;
			return result;
		}
		for ( let i = 0; i < CORRECT.length; ++ i ) {
			const num = read( 1 );
			if ( num === CORRECT[ i ] ) {
				return false;
			}
		}
		return true;
	}
	function getFbxVersion( text ) {
		const versionRegExp = /FBXVersion: (\d+)/;
		const match = text.match( versionRegExp );
		if ( match ) {
			const version = parseInt( match[ 1 ] );
			return version;
		}
		throw new Error( 'THREE.FBXLoader: Cannot find the version number for the file given.' );
	}
	function convertFBXTimeToSeconds( time ) {
		return time / 46186158000;
	}
	const dataArray = [];
	function getData( polygonVertexIndex, polygonIndex, vertexIndex, infoObject ) {
		let index;
		switch ( infoObject.mappingType ) {
			case 'ByPolygonVertex':
				index = polygonVertexIndex;
				break;
			case 'ByPolygon':
				index = polygonIndex;
				break;
			case 'ByVertice':
				index = vertexIndex;
				break;
			case 'AllSame':
				index = infoObject.indices[ 0 ];
				break;
			default:
				console.warn( 'THREE.FBXLoader: unknown attribute mapping type ' + infoObject.mappingType );
		}
		if ( infoObject.referenceType === 'IndexToDirect' ) index = infoObject.indices[ index ];
		const from = index * infoObject.dataSize;
		const to = from + infoObject.dataSize;
		return slice( dataArray, infoObject.buffer, from, to );
	}
	const tempEuler = new THREE.Euler();
	const tempVec = new THREE.Vector3();
	function generateTransform( transformData ) {
		const lTranslationM = new THREE.Matrix4();
		const lPreRotationM = new THREE.Matrix4();
		const lRotationM = new THREE.Matrix4();
		const lPostRotationM = new THREE.Matrix4();
		const lScalingM = new THREE.Matrix4();
		const lScalingPivotM = new THREE.Matrix4();
		const lScalingOffsetM = new THREE.Matrix4();
		const lRotationOffsetM = new THREE.Matrix4();
		const lRotationPivotM = new THREE.Matrix4();
		const lParentGX = new THREE.Matrix4();
		const lParentLX = new THREE.Matrix4();
		const lGlobalT = new THREE.Matrix4();
		const inheritType = transformData.inheritType ? transformData.inheritType : 0;
		if ( transformData.translation ) lTranslationM.setPosition( tempVec.fromArray( transformData.translation ) );
		if ( transformData.preRotation ) {
			const array = transformData.preRotation.map( THREE.MathUtils.degToRad );
			array.push( transformData.eulerOrder );
			lPreRotationM.makeRotationFromEuler( tempEuler.fromArray( array ) );
		}
		if ( transformData.rotation ) {
			const array = transformData.rotation.map( THREE.MathUtils.degToRad );
			array.push( transformData.eulerOrder );
			lRotationM.makeRotationFromEuler( tempEuler.fromArray( array ) );
		}
		if ( transformData.postRotation ) {
			const array = transformData.postRotation.map( THREE.MathUtils.degToRad );
			array.push( transformData.eulerOrder );
			lPostRotationM.makeRotationFromEuler( tempEuler.fromArray( array ) );
			lPostRotationM.invert();
		}
		if ( transformData.scale ) lScalingM.scale( tempVec.fromArray( transformData.scale ) );
		if ( transformData.scalingOffset ) lScalingOffsetM.setPosition( tempVec.fromArray( transformData.scalingOffset ) );
		if ( transformData.scalingPivot ) lScalingPivotM.setPosition( tempVec.fromArray( transformData.scalingPivot ) );
		if ( transformData.rotationOffset ) lRotationOffsetM.setPosition( tempVec.fromArray( transformData.rotationOffset ) );
		if ( transformData.rotationPivot ) lRotationPivotM.setPosition( tempVec.fromArray( transformData.rotationPivot ) );
		if ( transformData.parentMatrixWorld ) {
			lParentLX.copy( transformData.parentMatrix );
			lParentGX.copy( transformData.parentMatrixWorld );
		}
		const lLRM = new THREE.Matrix4().copy( lPreRotationM ).multiply( lRotationM ).multiply( lPostRotationM );
		const lParentGRM = new THREE.Matrix4();
		lParentGRM.extractRotation( lParentGX );
		const lParentTM = new THREE.Matrix4();
		lParentTM.copyPosition( lParentGX );
		const lParentGSM = new THREE.Matrix4();
		const lParentGRSM = new THREE.Matrix4().copy( lParentTM ).invert().multiply( lParentGX );
		lParentGSM.copy( lParentGRM ).invert().multiply( lParentGRSM );
		const lLSM = lScalingM;
		const lGlobalRS = new THREE.Matrix4();
		if ( inheritType === 0 ) {
			lGlobalRS.copy( lParentGRM ).multiply( lLRM ).multiply( lParentGSM ).multiply( lLSM );
		} else if ( inheritType === 1 ) {
			lGlobalRS.copy( lParentGRM ).multiply( lParentGSM ).multiply( lLRM ).multiply( lLSM );
		} else {
			const lParentLSM = new THREE.Matrix4().scale( new THREE.Vector3().setFromMatrixScale( lParentLX ) );
			const lParentLSM_inv = new THREE.Matrix4().copy( lParentLSM ).invert();
			const lParentGSM_noLocal = new THREE.Matrix4().copy( lParentGSM ).multiply( lParentLSM_inv );
			lGlobalRS.copy( lParentGRM ).multiply( lLRM ).multiply( lParentGSM_noLocal ).multiply( lLSM );
		}
		const lRotationPivotM_inv = new THREE.Matrix4();
		lRotationPivotM_inv.copy( lRotationPivotM ).invert();
		const lScalingPivotM_inv = new THREE.Matrix4();
		lScalingPivotM_inv.copy( lScalingPivotM ).invert();
		let lTransform = new THREE.Matrix4();
		lTransform.copy( lTranslationM ).multiply( lRotationOffsetM ).multiply( lRotationPivotM ).multiply( lPreRotationM ).multiply( lRotationM ).multiply( lPostRotationM ).multiply( lRotationPivotM_inv ).multiply( lScalingOffsetM ).multiply( lScalingPivotM ).multiply( lScalingM ).multiply( lScalingPivotM_inv );
		const lLocalTWithAllPivotAndOffsetInfo = new THREE.Matrix4().copyPosition( lTransform );
		const lGlobalTranslation = new THREE.Matrix4().copy( lParentGX ).multiply( lLocalTWithAllPivotAndOffsetInfo );
		lGlobalT.copyPosition( lGlobalTranslation );
		lTransform = new THREE.Matrix4().copy( lGlobalT ).multiply( lGlobalRS );
		lTransform.premultiply( lParentGX.invert() );
		return lTransform;
	}
	function getEulerOrder( order ) {
		order = order || 0;
		const enums = [ 'ZYX',
			'YZX',
			'XZY',
			'ZXY',
			'YXZ',
			'XYZ'
		];
		if ( order === 6 ) {
			console.warn( 'THREE.FBXLoader: unsupported THREE.Euler Order: Spherical XYZ. Animations and rotations may be incorrect.' );
			return enums[ 0 ];
		}
		return enums[ order ];
	}
	function parseNumberArray( value ) {
		const array = value.split( ',' ).map( function ( val ) {
			return parseFloat( val );
		} );
		return array;
	}
	function convertArrayBufferToString( buffer, from, to ) {
		if ( from === undefined ) from = 0;
		if ( to === undefined ) to = buffer.byteLength;
		return THREE.LoaderUtils.decodeText( new Uint8Array( buffer, from, to ) );
	}
	function append( a, b ) {
		for ( let i = 0, j = a.length, l = b.length; i < l; i ++, j ++ ) {
			a[ j ] = b[ i ];
		}
	}
	function slice( a, b, from, to ) {
		for ( let i = from, j = 0; i < to; i ++, j ++ ) {
			a[ j ] = b[ i ];
		}
		return a;
	}
	function inject( a1, index, a2 ) {
		return a1.slice( 0, index ).concat( a2 ).concat( a1.slice( index ) );
	}
	THREE.FBXLoader = FBXLoader;
} )();
( function () {
	const _object_pattern = /^[og]\s*(.+)?/;
	const _material_library_pattern = /^mtllib /;
	const _material_use_pattern = /^usemtl /;
	const _map_use_pattern = /^usemap /;
	const _vA = new THREE.Vector3();
	const _vB = new THREE.Vector3();
	const _vC = new THREE.Vector3();
	const _ab = new THREE.Vector3();
	const _cb = new THREE.Vector3();
	function ParserState() {
		const state = {
			objects: [],
			object: {},
			vertices: [],
			normals: [],
			colors: [],
			uvs: [],
			materials: {},
			materialLibraries: [],
			startObject: function ( name, fromDeclaration ) {
				if ( this.object && this.object.fromDeclaration === false ) {
					this.object.name = name;
					this.object.fromDeclaration = fromDeclaration !== false;
					return;
				}
				const previousMaterial = this.object && typeof this.object.currentMaterial === 'function' ? this.object.currentMaterial() : undefined;
				if ( this.object && typeof this.object._finalize === 'function' ) {
					this.object._finalize( true );
				}
				this.object = {
					name: name || '',
					fromDeclaration: fromDeclaration !== false,
					geometry: {
						vertices: [],
						normals: [],
						colors: [],
						uvs: [],
						hasUVIndices: false
					},
					materials: [],
					smooth: true,
					startMaterial: function ( name, libraries ) {
						const previous = this._finalize( false );
						if ( previous && ( previous.inherited || previous.groupCount <= 0 ) ) {
							this.materials.splice( previous.index, 1 );
						}
						const material = {
							index: this.materials.length,
							name: name || '',
							mtllib: Array.isArray( libraries ) && libraries.length > 0 ? libraries[ libraries.length - 1 ] : '',
							smooth: previous !== undefined ? previous.smooth : this.smooth,
							groupStart: previous !== undefined ? previous.groupEnd : 0,
							groupEnd: - 1,
							groupCount: - 1,
							inherited: false,
							clone: function ( index ) {
								const cloned = {
									index: typeof index === 'number' ? index : this.index,
									name: this.name,
									mtllib: this.mtllib,
									smooth: this.smooth,
									groupStart: 0,
									groupEnd: - 1,
									groupCount: - 1,
									inherited: false
								};
								cloned.clone = this.clone.bind( cloned );
								return cloned;
							}
						};
						this.materials.push( material );
						return material;
					},
					currentMaterial: function () {
						if ( this.materials.length > 0 ) {
							return this.materials[ this.materials.length - 1 ];
						}
						return undefined;
					},
					_finalize: function ( end ) {
						const lastMultiMaterial = this.currentMaterial();
						if ( lastMultiMaterial && lastMultiMaterial.groupEnd === - 1 ) {
							lastMultiMaterial.groupEnd = this.geometry.vertices.length / 3;
							lastMultiMaterial.groupCount = lastMultiMaterial.groupEnd - lastMultiMaterial.groupStart;
							lastMultiMaterial.inherited = false;
						}
						if ( end && this.materials.length > 1 ) {
							for ( let mi = this.materials.length - 1; mi >= 0; mi -- ) {
								if ( this.materials[ mi ].groupCount <= 0 ) {
									this.materials.splice( mi, 1 );
								}
							}
						}
						if ( end && this.materials.length === 0 ) {
							this.materials.push( {
								name: '',
								smooth: this.smooth
							} );
						}
						return lastMultiMaterial;
					}
				};
				if ( previousMaterial && previousMaterial.name && typeof previousMaterial.clone === 'function' ) {
					const declared = previousMaterial.clone( 0 );
					declared.inherited = true;
					this.object.materials.push( declared );
				}
				this.objects.push( this.object );
			},
			finalize: function () {
				if ( this.object && typeof this.object._finalize === 'function' ) {
					this.object._finalize( true );
				}
			},
			parseVertexIndex: function ( value, len ) {
				const index = parseInt( value, 10 );
				return ( index >= 0 ? index - 1 : index + len / 3 ) * 3;
			},
			parseNormalIndex: function ( value, len ) {
				const index = parseInt( value, 10 );
				return ( index >= 0 ? index - 1 : index + len / 3 ) * 3;
			},
			parseUVIndex: function ( value, len ) {
				const index = parseInt( value, 10 );
				return ( index >= 0 ? index - 1 : index + len / 2 ) * 2;
			},
			addVertex: function ( a, b, c ) {
				const src = this.vertices;
				const dst = this.object.geometry.vertices;
				dst.push( src[ a + 0 ], src[ a + 1 ], src[ a + 2 ] );
				dst.push( src[ b + 0 ], src[ b + 1 ], src[ b + 2 ] );
				dst.push( src[ c + 0 ], src[ c + 1 ], src[ c + 2 ] );
			},
			addVertexPoint: function ( a ) {
				const src = this.vertices;
				const dst = this.object.geometry.vertices;
				dst.push( src[ a + 0 ], src[ a + 1 ], src[ a + 2 ] );
			},
			addVertexLine: function ( a ) {
				const src = this.vertices;
				const dst = this.object.geometry.vertices;
				dst.push( src[ a + 0 ], src[ a + 1 ], src[ a + 2 ] );
			},
			addNormal: function ( a, b, c ) {
				const src = this.normals;
				const dst = this.object.geometry.normals;
				dst.push( src[ a + 0 ], src[ a + 1 ], src[ a + 2 ] );
				dst.push( src[ b + 0 ], src[ b + 1 ], src[ b + 2 ] );
				dst.push( src[ c + 0 ], src[ c + 1 ], src[ c + 2 ] );
			},
			addFaceNormal: function ( a, b, c ) {
				const src = this.vertices;
				const dst = this.object.geometry.normals;
				_vA.fromArray( src, a );
				_vB.fromArray( src, b );
				_vC.fromArray( src, c );
				_cb.subVectors( _vC, _vB );
				_ab.subVectors( _vA, _vB );
				_cb.cross( _ab );
				_cb.normalize();
				dst.push( _cb.x, _cb.y, _cb.z );
				dst.push( _cb.x, _cb.y, _cb.z );
				dst.push( _cb.x, _cb.y, _cb.z );
			},
			addColor: function ( a, b, c ) {
				const src = this.colors;
				const dst = this.object.geometry.colors;
				if ( src[ a ] !== undefined ) dst.push( src[ a + 0 ], src[ a + 1 ], src[ a + 2 ] );
				if ( src[ b ] !== undefined ) dst.push( src[ b + 0 ], src[ b + 1 ], src[ b + 2 ] );
				if ( src[ c ] !== undefined ) dst.push( src[ c + 0 ], src[ c + 1 ], src[ c + 2 ] );
			},
			addUV: function ( a, b, c ) {
				const src = this.uvs;
				const dst = this.object.geometry.uvs;
				dst.push( src[ a + 0 ], src[ a + 1 ] );
				dst.push( src[ b + 0 ], src[ b + 1 ] );
				dst.push( src[ c + 0 ], src[ c + 1 ] );
			},
			addDefaultUV: function () {
				const dst = this.object.geometry.uvs;
				dst.push( 0, 0 );
				dst.push( 0, 0 );
				dst.push( 0, 0 );
			},
			addUVLine: function ( a ) {
				const src = this.uvs;
				const dst = this.object.geometry.uvs;
				dst.push( src[ a + 0 ], src[ a + 1 ] );
			},
			addFace: function ( a, b, c, ua, ub, uc, na, nb, nc ) {
				const vLen = this.vertices.length;
				let ia = this.parseVertexIndex( a, vLen );
				let ib = this.parseVertexIndex( b, vLen );
				let ic = this.parseVertexIndex( c, vLen );
				this.addVertex( ia, ib, ic );
				this.addColor( ia, ib, ic );
				if ( na !== undefined && na !== '' ) {
					const nLen = this.normals.length;
					ia = this.parseNormalIndex( na, nLen );
					ib = this.parseNormalIndex( nb, nLen );
					ic = this.parseNormalIndex( nc, nLen );
					this.addNormal( ia, ib, ic );
				} else {
					this.addFaceNormal( ia, ib, ic );
				}
				if ( ua !== undefined && ua !== '' ) {
					const uvLen = this.uvs.length;
					ia = this.parseUVIndex( ua, uvLen );
					ib = this.parseUVIndex( ub, uvLen );
					ic = this.parseUVIndex( uc, uvLen );
					this.addUV( ia, ib, ic );
					this.object.geometry.hasUVIndices = true;
				} else {
					this.addDefaultUV();
				}
			},
			addPointGeometry: function ( vertices ) {
				this.object.geometry.type = 'Points';
				const vLen = this.vertices.length;
				for ( let vi = 0, l = vertices.length; vi < l; vi ++ ) {
					const index = this.parseVertexIndex( vertices[ vi ], vLen );
					this.addVertexPoint( index );
					this.addColor( index );
				}
			},
			addLineGeometry: function ( vertices, uvs ) {
				this.object.geometry.type = 'Line';
				const vLen = this.vertices.length;
				const uvLen = this.uvs.length;
				for ( let vi = 0, l = vertices.length; vi < l; vi ++ ) {
					this.addVertexLine( this.parseVertexIndex( vertices[ vi ], vLen ) );
				}
				for ( let uvi = 0, l = uvs.length; uvi < l; uvi ++ ) {
					this.addUVLine( this.parseUVIndex( uvs[ uvi ], uvLen ) );
				}
			}
		};
		state.startObject( '', false );
		return state;
	}
	class OBJLoader extends THREE.Loader {
		constructor( manager ) {
			super( manager );
			this.materials = null;
		}
		load( url, onLoad, onProgress, onError ) {
			const scope = this;
			const loader = new THREE.FileLoader( this.manager );
			loader.setPath( this.path );
			loader.setRequestHeader( this.requestHeader );
			loader.setWithCredentials( this.withCredentials );
			loader.load( url, function ( text ) {
				try {
					onLoad( scope.parse( text ) );
				} catch ( e ) {
					if ( onError ) {
						onError( e );
					} else {
						console.error( e );
					}
					scope.manager.itemError( url );
				}
			}, onProgress, onError );
		}
		setMaterials( materials ) {
			this.materials = materials;
			return this;
		}
		parse( text ) {
			const state = new ParserState();
			if ( text.indexOf( '\r\n' ) !== - 1 ) {
				text = text.replace( /\r\n/g, '\n' );
			}
			if ( text.indexOf( '\\\n' ) !== - 1 ) {
				text = text.replace( /\\\n/g, '' );
			}
			const lines = text.split( '\n' );
			let line = '',
				lineFirstChar = '';
			let lineLength = 0;
			let result = [];
			const trimLeft = typeof ''.trimLeft === 'function';
			for ( let i = 0, l = lines.length; i < l; i ++ ) {
				line = lines[ i ];
				line = trimLeft ? line.trimLeft() : line.trim();
				lineLength = line.length;
				if ( lineLength === 0 ) continue;
				lineFirstChar = line.charAt( 0 );
				if ( lineFirstChar === '#' ) continue;
				if ( lineFirstChar === 'v' ) {
					const data = line.split( /\s+/ );
					switch ( data[ 0 ] ) {
						case 'v':
							state.vertices.push( parseFloat( data[ 1 ] ), parseFloat( data[ 2 ] ), parseFloat( data[ 3 ] ) );
							if ( data.length >= 7 ) {
								state.colors.push( parseFloat( data[ 4 ] ), parseFloat( data[ 5 ] ), parseFloat( data[ 6 ] ) );
							} else {
								state.colors.push( undefined, undefined, undefined );
							}
							break;
						case 'vn':
							state.normals.push( parseFloat( data[ 1 ] ), parseFloat( data[ 2 ] ), parseFloat( data[ 3 ] ) );
							break;
						case 'vt':
							state.uvs.push( parseFloat( data[ 1 ] ), parseFloat( data[ 2 ] ) );
							break;
					}
				} else if ( lineFirstChar === 'f' ) {
					const lineData = line.substr( 1 ).trim();
					const vertexData = lineData.split( /\s+/ );
					const faceVertices = [];
					for ( let j = 0, jl = vertexData.length; j < jl; j ++ ) {
						const vertex = vertexData[ j ];
						if ( vertex.length > 0 ) {
							const vertexParts = vertex.split( '/' );
							faceVertices.push( vertexParts );
						}
					}
					const v1 = faceVertices[ 0 ];
					for ( let j = 1, jl = faceVertices.length - 1; j < jl; j ++ ) {
						const v2 = faceVertices[ j ];
						const v3 = faceVertices[ j + 1 ];
						state.addFace( v1[ 0 ], v2[ 0 ], v3[ 0 ], v1[ 1 ], v2[ 1 ], v3[ 1 ], v1[ 2 ], v2[ 2 ], v3[ 2 ] );
					}
				} else if ( lineFirstChar === 'l' ) {
					const lineParts = line.substring( 1 ).trim().split( ' ' );
					let lineVertices = [];
					const lineUVs = [];
					if ( line.indexOf( '/' ) === - 1 ) {
						lineVertices = lineParts;
					} else {
						for ( let li = 0, llen = lineParts.length; li < llen; li ++ ) {
							const parts = lineParts[ li ].split( '/' );
							if ( parts[ 0 ] !== '' ) lineVertices.push( parts[ 0 ] );
							if ( parts[ 1 ] !== '' ) lineUVs.push( parts[ 1 ] );
						}
					}
					state.addLineGeometry( lineVertices, lineUVs );
				} else if ( lineFirstChar === 'p' ) {
					const lineData = line.substr( 1 ).trim();
					const pointData = lineData.split( ' ' );
					state.addPointGeometry( pointData );
				} else if ( ( result = _object_pattern.exec( line ) ) !== null ) {
					const name = ( ' ' + result[ 0 ].substr( 1 ).trim() ).substr( 1 );
					state.startObject( name );
				} else if ( _material_use_pattern.test( line ) ) {
					state.object.startMaterial( line.substring( 7 ).trim(), state.materialLibraries );
				} else if ( _material_library_pattern.test( line ) ) {
					state.materialLibraries.push( line.substring( 7 ).trim() );
				} else if ( _map_use_pattern.test( line ) ) {
					console.warn( 'THREE.OBJLoader: Rendering identifier "usemap" not supported. Textures must be defined in MTL files.' );
				} else if ( lineFirstChar === 's' ) {
					result = line.split( ' ' );
					if ( result.length > 1 ) {
						const value = result[ 1 ].trim().toLowerCase();
						state.object.smooth = value !== '0' && value !== 'off';
					} else {
						state.object.smooth = true;
					}
					const material = state.object.currentMaterial();
					if ( material ) material.smooth = state.object.smooth;
				} else {
					if ( line === '\0' ) continue;
					console.warn( 'THREE.OBJLoader: Unexpected line: "' + line + '"' );
				}
			}
			state.finalize();
			const container = new THREE.Group();
			container.materialLibraries = [].concat( state.materialLibraries );
			const hasPrimitives = ! ( state.objects.length === 1 && state.objects[ 0 ].geometry.vertices.length === 0 );
			if ( hasPrimitives === true ) {
				for ( let i = 0, l = state.objects.length; i < l; i ++ ) {
					const object = state.objects[ i ];
					const geometry = object.geometry;
					const materials = object.materials;
					const isLine = geometry.type === 'Line';
					const isPoints = geometry.type === 'Points';
					let hasVertexColors = false;
					if ( geometry.vertices.length === 0 ) continue;
					const buffergeometry = new THREE.BufferGeometry();
					buffergeometry.setAttribute( 'position', new THREE.Float32BufferAttribute( geometry.vertices, 3 ) );
					if ( geometry.normals.length > 0 ) {
						buffergeometry.setAttribute( 'normal', new THREE.Float32BufferAttribute( geometry.normals, 3 ) );
					}
					if ( geometry.colors.length > 0 ) {
						hasVertexColors = true;
						buffergeometry.setAttribute( 'color', new THREE.Float32BufferAttribute( geometry.colors, 3 ) );
					}
					if ( geometry.hasUVIndices === true ) {
						buffergeometry.setAttribute( 'uv', new THREE.Float32BufferAttribute( geometry.uvs, 2 ) );
					}
					const createdMaterials = [];
					for ( let mi = 0, miLen = materials.length; mi < miLen; mi ++ ) {
						const sourceMaterial = materials[ mi ];
						const materialHash = sourceMaterial.name + '_' + sourceMaterial.smooth + '_' + hasVertexColors;
						let material = state.materials[ materialHash ];
						if ( this.materials !== null ) {
							material = this.materials.create( sourceMaterial.name );
							if ( isLine && material && ! ( material instanceof THREE.LineBasicMaterial ) ) {
								const materialLine = new THREE.LineBasicMaterial();
								THREE.Material.prototype.copy.call( materialLine, material );
								materialLine.color.copy( material.color );
								material = materialLine;
							} else if ( isPoints && material && ! ( material instanceof THREE.PointsMaterial ) ) {
								const materialPoints = new THREE.PointsMaterial( {
									size: 10,
									sizeAttenuation: false
								} );
								THREE.Material.prototype.copy.call( materialPoints, material );
								materialPoints.color.copy( material.color );
								materialPoints.map = material.map;
								material = materialPoints;
							}
						}
						if ( material === undefined ) {
							if ( isLine ) {
								material = new THREE.LineBasicMaterial();
							} else if ( isPoints ) {
								material = new THREE.PointsMaterial( {
									size: 1,
									sizeAttenuation: false
								} );
							} else {
								material = new THREE.MeshPhongMaterial();
							}
							material.name = sourceMaterial.name;
							material.flatShading = sourceMaterial.smooth ? false : true;
							material.vertexColors = hasVertexColors;
							state.materials[ materialHash ] = material;
						}
						createdMaterials.push( material );
					}
					let mesh;
					if ( createdMaterials.length > 1 ) {
						for ( let mi = 0, miLen = materials.length; mi < miLen; mi ++ ) {
							const sourceMaterial = materials[ mi ];
							buffergeometry.addGroup( sourceMaterial.groupStart, sourceMaterial.groupCount, mi );
						}
						if ( isLine ) {
							mesh = new THREE.LineSegments( buffergeometry, createdMaterials );
						} else if ( isPoints ) {
							mesh = new THREE.Points( buffergeometry, createdMaterials );
						} else {
							mesh = new THREE.Mesh( buffergeometry, createdMaterials );
						}
					} else {
						if ( isLine ) {
							mesh = new THREE.LineSegments( buffergeometry, createdMaterials[ 0 ] );
						} else if ( isPoints ) {
							mesh = new THREE.Points( buffergeometry, createdMaterials[ 0 ] );
						} else {
							mesh = new THREE.Mesh( buffergeometry, createdMaterials[ 0 ] );
						}
					}
					mesh.name = object.name;
					container.add( mesh );
				}
			} else {
				if ( state.vertices.length > 0 ) {
					const material = new THREE.PointsMaterial( {
						size: 1,
						sizeAttenuation: false
					} );
					const buffergeometry = new THREE.BufferGeometry();
					buffergeometry.setAttribute( 'position', new THREE.Float32BufferAttribute( state.vertices, 3 ) );
					if ( state.colors.length > 0 && state.colors[ 0 ] !== undefined ) {
						buffergeometry.setAttribute( 'color', new THREE.Float32BufferAttribute( state.colors, 3 ) );
						material.vertexColors = true;
					}
					const points = new THREE.Points( buffergeometry, material );
					container.add( points );
				}
			}
			return container;
		}
	}
	THREE.OBJLoader = OBJLoader;
} )();
( function () {
	class MTLLoader extends THREE.Loader {
		constructor( manager ) {
			super( manager );
		}
		load( url, onLoad, onProgress, onError ) {
			const scope = this;
			const path = this.path === '' ? THREE.LoaderUtils.extractUrlBase( url ) : this.path;
			const loader = new THREE.FileLoader( this.manager );
			loader.setPath( this.path );
			loader.setRequestHeader( this.requestHeader );
			loader.setWithCredentials( this.withCredentials );
			loader.load( url, function ( text ) {
				try {
					onLoad( scope.parse( text, path ) );
				} catch ( e ) {
					if ( onError ) {
						onError( e );
					} else {
						console.error( e );
					}
					scope.manager.itemError( url );
				}
			}, onProgress, onError );
		}
		setMaterialOptions( value ) {
			this.materialOptions = value;
			return this;
		}
		parse( text, path ) {
			const lines = text.split( '\n' );
			let info = {};
			const delimiter_pattern = /\s+/;
			const materialsInfo = {};
			for ( let i = 0; i < lines.length; i ++ ) {
				let line = lines[ i ];
				line = line.trim();
				if ( line.length === 0 || line.charAt( 0 ) === '#' ) {
					continue;
				}
				const pos = line.indexOf( ' ' );
				let key = pos >= 0 ? line.substring( 0, pos ) : line;
				key = key.toLowerCase();
				let value = pos >= 0 ? line.substring( pos + 1 ) : '';
				value = value.trim();
				if ( key === 'newmtl' ) {
					info = {
						name: value
					};
					materialsInfo[ value ] = info;
				} else {
					if ( key === 'ka' || key === 'kd' || key === 'ks' || key === 'ke' ) {
						const ss = value.split( delimiter_pattern, 3 );
						info[ key ] = [ parseFloat( ss[ 0 ] ), parseFloat( ss[ 1 ] ), parseFloat( ss[ 2 ] ) ];
					} else {
						info[ key ] = value;
					}
				}
			}
			const materialCreator = new MaterialCreator( this.resourcePath || path, this.materialOptions );
			materialCreator.setCrossOrigin( this.crossOrigin );
			materialCreator.setManager( this.manager );
			materialCreator.setMaterials( materialsInfo );
			return materialCreator;
		}
	}
	class MaterialCreator {
		constructor( baseUrl = '', options = {} ) {
			this.baseUrl = baseUrl;
			this.options = options;
			this.materialsInfo = {};
			this.materials = {};
			this.materialsArray = [];
			this.nameLookup = {};
			this.crossOrigin = 'anonymous';
			this.side = this.options.side !== undefined ? this.options.side : THREE.FrontSide;
			this.wrap = this.options.wrap !== undefined ? this.options.wrap : THREE.RepeatWrapping;
		}
		setCrossOrigin( value ) {
			this.crossOrigin = value;
			return this;
		}
		setManager( value ) {
			this.manager = value;
		}
		setMaterials( materialsInfo ) {
			this.materialsInfo = this.convert( materialsInfo );
			this.materials = {};
			this.materialsArray = [];
			this.nameLookup = {};
		}
		convert( materialsInfo ) {
			if ( ! this.options ) return materialsInfo;
			const converted = {};
			for ( const mn in materialsInfo ) {
				const mat = materialsInfo[ mn ];
				const covmat = {};
				converted[ mn ] = covmat;
				for ( const prop in mat ) {
					let save = true;
					let value = mat[ prop ];
					const lprop = prop.toLowerCase();
					switch ( lprop ) {
						case 'kd':
						case 'ka':
						case 'ks':
							if ( this.options && this.options.normalizeRGB ) {
								value = [ value[ 0 ] / 255, value[ 1 ] / 255, value[ 2 ] / 255 ];
							}
							if ( this.options && this.options.ignoreZeroRGBs ) {
								if ( value[ 0 ] === 0 && value[ 1 ] === 0 && value[ 2 ] === 0 ) {
									save = false;
								}
							}
							break;
						default:
							break;
					}
					if ( save ) {
						covmat[ lprop ] = value;
					}
				}
			}
			return converted;
		}
		preload() {
			for ( const mn in this.materialsInfo ) {
				this.create( mn );
			}
		}
		getIndex( materialName ) {
			return this.nameLookup[ materialName ];
		}
		getAsArray() {
			let index = 0;
			for ( const mn in this.materialsInfo ) {
				this.materialsArray[ index ] = this.create( mn );
				this.nameLookup[ mn ] = index;
				index ++;
			}
			return this.materialsArray;
		}
		create( materialName ) {
			if ( this.materials[ materialName ] === undefined ) {
				this.createMaterial_( materialName );
			}
			return this.materials[ materialName ];
		}
		createMaterial_( materialName ) {
			const scope = this;
			const mat = this.materialsInfo[ materialName ];
			const params = {
				name: materialName,
				side: this.side
			};
			function resolveURL( baseUrl, url ) {
				if ( typeof url !== 'string' || url === '' ) return '';
				if ( /^https?:\/\//i.test( url ) ) return url;
				return baseUrl + url;
			}
			function setMapForType( mapType, value ) {
				if ( params[ mapType ] ) return;
				const texParams = scope.getTextureParams( value, params );
				const map = scope.loadTexture( resolveURL( scope.baseUrl, texParams.url ) );
				map.repeat.copy( texParams.scale );
				map.offset.copy( texParams.offset );
				map.wrapS = scope.wrap;
				map.wrapT = scope.wrap;
				params[ mapType ] = map;
			}
			for ( const prop in mat ) {
				const value = mat[ prop ];
				let n;
				if ( value === '' ) continue;
				switch ( prop.toLowerCase() ) {
					case 'kd':
						params.color = new THREE.Color().fromArray( value );
						break;
					case 'ks':
						params.specular = new THREE.Color().fromArray( value );
						break;
					case 'ke':
						params.emissive = new THREE.Color().fromArray( value );
						break;
					case 'map_kd':
						setMapForType( 'map', value );
						break;
					case 'map_ks':
						setMapForType( 'specularMap', value );
						break;
					case 'map_ke':
						setMapForType( 'emissiveMap', value );
						break;
					case 'norm':
						setMapForType( 'normalMap', value );
						break;
					case 'map_bump':
					case 'bump':
						setMapForType( 'bumpMap', value );
						break;
					case 'map_d':
						setMapForType( 'alphaMap', value );
						params.transparent = true;
						break;
					case 'ns':
						params.shininess = parseFloat( value );
						break;
					case 'd':
						n = parseFloat( value );
						if ( n < 1 ) {
							params.opacity = n;
							params.transparent = true;
						}
						break;
					case 'tr':
						n = parseFloat( value );
						if ( this.options && this.options.invertTrProperty ) n = 1 - n;
						if ( n > 0 ) {
							params.opacity = 1 - n;
							params.transparent = true;
						}
						break;
					default:
						break;
				}
			}
			this.materials[ materialName ] = new THREE.MeshPhongMaterial( params );
			return this.materials[ materialName ];
		}
		getTextureParams( value, matParams ) {
			const texParams = {
				scale: new THREE.Vector2( 1, 1 ),
				offset: new THREE.Vector2( 0, 0 )
			};
			const items = value.split( /\s+/ );
			let pos;
			pos = items.indexOf( '-bm' );
			if ( pos >= 0 ) {
				matParams.bumpScale = parseFloat( items[ pos + 1 ] );
				items.splice( pos, 2 );
			}
			pos = items.indexOf( '-s' );
			if ( pos >= 0 ) {
				texParams.scale.set( parseFloat( items[ pos + 1 ] ), parseFloat( items[ pos + 2 ] ) );
				items.splice( pos, 4 );
			}
			pos = items.indexOf( '-o' );
			if ( pos >= 0 ) {
				texParams.offset.set( parseFloat( items[ pos + 1 ] ), parseFloat( items[ pos + 2 ] ) );
				items.splice( pos, 4 );
			}
			texParams.url = items.join( ' ' ).trim();
			return texParams;
		}
		loadTexture( url, mapping, onLoad, onProgress, onError ) {
			const manager = this.manager !== undefined ? this.manager : THREE.DefaultLoadingManager;
			let loader = manager.getHandler( url );
			if ( loader === null ) {
				loader = new THREE.TextureLoader( manager );
			}
			if ( loader.setCrossOrigin ) loader.setCrossOrigin( this.crossOrigin );
			const texture = loader.load( url, onLoad, onProgress, onError );
			if ( mapping !== undefined ) texture.mapping = mapping;
			return texture;
		}
	}
	THREE.MTLLoader = MTLLoader;
} )();
( function () {
	class PLYLoader extends THREE.Loader {
		constructor( manager ) {
			super( manager );
			this.propertyNameMapping = {};
		}
		load( url, onLoad, onProgress, onError ) {
			const scope = this;
			const loader = new THREE.FileLoader( this.manager );
			loader.setPath( this.path );
			loader.setResponseType( 'arraybuffer' );
			loader.setRequestHeader( this.requestHeader );
			loader.setWithCredentials( this.withCredentials );
			loader.load( url, function ( text ) {
				try {
					onLoad( scope.parse( text ) );
				} catch ( e ) {
					if ( onError ) {
						onError( e );
					} else {
						console.error( e );
					}
					scope.manager.itemError( url );
				}
			}, onProgress, onError );
		}
		setPropertyNameMapping( mapping ) {
			this.propertyNameMapping = mapping;
		}
		parse( data ) {
			function parseHeader( data ) {
				const patternHeader = /ply([\s\S]*)end_header\r?\n/;
				let headerText = '';
				let headerLength = 0;
				const result = patternHeader.exec( data );
				if ( result !== null ) {
					headerText = result[ 1 ];
					headerLength = new Blob( [ result[ 0 ] ] ).size;
				}
				const header = {
					comments: [],
					elements: [],
					headerLength: headerLength,
					objInfo: ''
				};
				const lines = headerText.split( '\n' );
				let currentElement;
				function make_ply_element_property( propertValues, propertyNameMapping ) {
					const property = {
						type: propertValues[ 0 ]
					};
					if ( property.type === 'list' ) {
						property.name = propertValues[ 3 ];
						property.countType = propertValues[ 1 ];
						property.itemType = propertValues[ 2 ];
					} else {
						property.name = propertValues[ 1 ];
					}
					if ( property.name in propertyNameMapping ) {
						property.name = propertyNameMapping[ property.name ];
					}
					return property;
				}
				for ( let i = 0; i < lines.length; i ++ ) {
					let line = lines[ i ];
					line = line.trim();
					if ( line === '' ) continue;
					const lineValues = line.split( /\s+/ );
					const lineType = lineValues.shift();
					line = lineValues.join( ' ' );
					switch ( lineType ) {
						case 'format':
							header.format = lineValues[ 0 ];
							header.version = lineValues[ 1 ];
							break;
						case 'comment':
							header.comments.push( line );
							break;
						case 'element':
							if ( currentElement !== undefined ) {
								header.elements.push( currentElement );
							}
							currentElement = {};
							currentElement.name = lineValues[ 0 ];
							currentElement.count = parseInt( lineValues[ 1 ] );
							currentElement.properties = [];
							break;
						case 'property':
							currentElement.properties.push( make_ply_element_property( lineValues, scope.propertyNameMapping ) );
							break;
						case 'obj_info':
							header.objInfo = line;
							break;
						default:
							console.log( 'unhandled', lineType, lineValues );
					}
				}
				if ( currentElement !== undefined ) {
					header.elements.push( currentElement );
				}
				return header;
			}
			function parseASCIINumber( n, type ) {
				switch ( type ) {
					case 'char':
					case 'uchar':
					case 'short':
					case 'ushort':
					case 'int':
					case 'uint':
					case 'int8':
					case 'uint8':
					case 'int16':
					case 'uint16':
					case 'int32':
					case 'uint32':
						return parseInt( n );
					case 'float':
					case 'double':
					case 'float32':
					case 'float64':
						return parseFloat( n );
				}
			}
			function parseASCIIElement( properties, line ) {
				const values = line.split( /\s+/ );
				const element = {};
				for ( let i = 0; i < properties.length; i ++ ) {
					if ( properties[ i ].type === 'list' ) {
						const list = [];
						const n = parseASCIINumber( values.shift(), properties[ i ].countType );
						for ( let j = 0; j < n; j ++ ) {
							list.push( parseASCIINumber( values.shift(), properties[ i ].itemType ) );
						}
						element[ properties[ i ].name ] = list;
					} else {
						element[ properties[ i ].name ] = parseASCIINumber( values.shift(), properties[ i ].type );
					}
				}
				return element;
			}
			function parseASCII( data, header ) {
				const buffer = {
					indices: [],
					vertices: [],
					normals: [],
					uvs: [],
					faceVertexUvs: [],
					colors: []
				};
				let result;
				const patternBody = /end_header\s([\s\S]*)$/;
				let body = '';
				if ( ( result = patternBody.exec( data ) ) !== null ) {
					body = result[ 1 ];
				}
				const lines = body.split( '\n' );
				let currentElement = 0;
				let currentElementCount = 0;
				for ( let i = 0; i < lines.length; i ++ ) {
					let line = lines[ i ];
					line = line.trim();
					if ( line === '' ) {
						continue;
					}
					if ( currentElementCount >= header.elements[ currentElement ].count ) {
						currentElement ++;
						currentElementCount = 0;
					}
					const element = parseASCIIElement( header.elements[ currentElement ].properties, line );
					handleElement( buffer, header.elements[ currentElement ].name, element );
					currentElementCount ++;
				}
				return postProcess( buffer );
			}
			function postProcess( buffer ) {
				let geometry = new THREE.BufferGeometry();
				if ( buffer.indices.length > 0 ) {
					geometry.setIndex( buffer.indices );
				}
				geometry.setAttribute( 'position', new THREE.Float32BufferAttribute( buffer.vertices, 3 ) );
				if ( buffer.normals.length > 0 ) {
					geometry.setAttribute( 'normal', new THREE.Float32BufferAttribute( buffer.normals, 3 ) );
				}
				if ( buffer.uvs.length > 0 ) {
					geometry.setAttribute( 'uv', new THREE.Float32BufferAttribute( buffer.uvs, 2 ) );
				}
				if ( buffer.colors.length > 0 ) {
					geometry.setAttribute( 'color', new THREE.Float32BufferAttribute( buffer.colors, 3 ) );
				}
				if ( buffer.faceVertexUvs.length > 0 ) {
					geometry = geometry.toNonIndexed();
					geometry.setAttribute( 'uv', new THREE.Float32BufferAttribute( buffer.faceVertexUvs, 2 ) );
				}
				geometry.computeBoundingSphere();
				return geometry;
			}
			function handleElement( buffer, elementName, element ) {
				if ( elementName === 'vertex' ) {
					buffer.vertices.push( element.x, element.y, element.z );
					if ( 'nx' in element && 'ny' in element && 'nz' in element ) {
						buffer.normals.push( element.nx, element.ny, element.nz );
					}
					if ( 's' in element && 't' in element ) {
						buffer.uvs.push( element.s, element.t );
					}
					if ( 'red' in element && 'green' in element && 'blue' in element ) {
						buffer.colors.push( element.red / 255.0, element.green / 255.0, element.blue / 255.0 );
					}
				} else if ( elementName === 'face' ) {
					const vertex_indices = element.vertex_indices || element.vertex_index;
					const texcoord = element.texcoord;
					if ( vertex_indices.length === 3 ) {
						buffer.indices.push( vertex_indices[ 0 ], vertex_indices[ 1 ], vertex_indices[ 2 ] );
						if ( texcoord && texcoord.length === 6 ) {
							buffer.faceVertexUvs.push( texcoord[ 0 ], texcoord[ 1 ] );
							buffer.faceVertexUvs.push( texcoord[ 2 ], texcoord[ 3 ] );
							buffer.faceVertexUvs.push( texcoord[ 4 ], texcoord[ 5 ] );
						}
					} else if ( vertex_indices.length === 4 ) {
						buffer.indices.push( vertex_indices[ 0 ], vertex_indices[ 1 ], vertex_indices[ 3 ] );
						buffer.indices.push( vertex_indices[ 1 ], vertex_indices[ 2 ], vertex_indices[ 3 ] );
					}
				}
			}
			function binaryRead( dataview, at, type, little_endian ) {
				switch ( type ) {
					case 'int8':
					case 'char':
						return [ dataview.getInt8( at ), 1 ];
					case 'uint8':
					case 'uchar':
						return [ dataview.getUint8( at ), 1 ];
					case 'int16':
					case 'short':
						return [ dataview.getInt16( at, little_endian ), 2 ];
					case 'uint16':
					case 'ushort':
						return [ dataview.getUint16( at, little_endian ), 2 ];
					case 'int32':
					case 'int':
						return [ dataview.getInt32( at, little_endian ), 4 ];
					case 'uint32':
					case 'uint':
						return [ dataview.getUint32( at, little_endian ), 4 ];
					case 'float32':
					case 'float':
						return [ dataview.getFloat32( at, little_endian ), 4 ];
					case 'float64':
					case 'double':
						return [ dataview.getFloat64( at, little_endian ), 8 ];
				}
			}
			function binaryReadElement( dataview, at, properties, little_endian ) {
				const element = {};
				let result,
					read = 0;
				for ( let i = 0; i < properties.length; i ++ ) {
					if ( properties[ i ].type === 'list' ) {
						const list = [];
						result = binaryRead( dataview, at + read, properties[ i ].countType, little_endian );
						const n = result[ 0 ];
						read += result[ 1 ];
						for ( let j = 0; j < n; j ++ ) {
							result = binaryRead( dataview, at + read, properties[ i ].itemType, little_endian );
							list.push( result[ 0 ] );
							read += result[ 1 ];
						}
						element[ properties[ i ].name ] = list;
					} else {
						result = binaryRead( dataview, at + read, properties[ i ].type, little_endian );
						element[ properties[ i ].name ] = result[ 0 ];
						read += result[ 1 ];
					}
				}
				return [ element, read ];
			}
			function parseBinary( data, header ) {
				const buffer = {
					indices: [],
					vertices: [],
					normals: [],
					uvs: [],
					faceVertexUvs: [],
					colors: []
				};
				const little_endian = header.format === 'binary_little_endian';
				const body = new DataView( data, header.headerLength );
				let result,
					loc = 0;
				for ( let currentElement = 0; currentElement < header.elements.length; currentElement ++ ) {
					for ( let currentElementCount = 0; currentElementCount < header.elements[ currentElement ].count; currentElementCount ++ ) {
						result = binaryReadElement( body, loc, header.elements[ currentElement ].properties, little_endian );
						loc += result[ 1 ];
						const element = result[ 0 ];
						handleElement( buffer, header.elements[ currentElement ].name, element );
					}
				}
				return postProcess( buffer );
			}
			let geometry;
			const scope = this;
			if ( data instanceof ArrayBuffer ) {
				const text = THREE.LoaderUtils.decodeText( new Uint8Array( data ) );
				const header = parseHeader( text );
				geometry = header.format === 'ascii' ? parseASCII( text, header ) : parseBinary( data, header );
			} else {
				geometry = parseASCII( data, parseHeader( data ) );
			}
			return geometry;
		}
	}
	THREE.PLYLoader = PLYLoader;
} )();
( function () {
	class STLLoader extends THREE.Loader {
		constructor( manager ) {
			super( manager );
		}
		load( url, onLoad, onProgress, onError ) {
			const scope = this;
			const loader = new THREE.FileLoader( this.manager );
			loader.setPath( this.path );
			loader.setResponseType( 'arraybuffer' );
			loader.setRequestHeader( this.requestHeader );
			loader.setWithCredentials( this.withCredentials );
			loader.load( url, function ( text ) {
				try {
					onLoad( scope.parse( text ) );
				} catch ( e ) {
					if ( onError ) {
						onError( e );
					} else {
						console.error( e );
					}
					scope.manager.itemError( url );
				}
			}, onProgress, onError );
		}
		parse( data ) {
			function isBinary( data ) {
				const reader = new DataView( data );
				const face_size = 32 / 8 * 3 + 32 / 8 * 3 * 3 + 16 / 8;
				const n_faces = reader.getUint32( 80, true );
				const expect = 80 + 32 / 8 + n_faces * face_size;
				if ( expect === reader.byteLength ) {
					return true;
				}
				const solid = [ 115, 111, 108, 105, 100 ];
				for ( let off = 0; off < 5; off ++ ) {
					if ( matchDataViewAt( solid, reader, off ) ) return false;
				}
				return true;
			}
			function matchDataViewAt( query, reader, offset ) {
				for ( let i = 0, il = query.length; i < il; i ++ ) {
					if ( query[ i ] !== reader.getUint8( offset + i, false ) ) return false;
				}
				return true;
			}
			function parseBinary( data ) {
				const reader = new DataView( data );
				const faces = reader.getUint32( 80, true );
				let r,
					g,
					b,
					hasColors = false,
					colors;
				let defaultR, defaultG, defaultB, alpha;
				for ( let index = 0; index < 80 - 10; index ++ ) {
					if ( reader.getUint32( index, false ) == 0x434F4C4F
        && reader.getUint8( index + 4 ) == 0x52
        && reader.getUint8( index + 5 ) == 0x3D
					) {
						hasColors = true;
						colors = new Float32Array( faces * 3 * 3 );
						defaultR = reader.getUint8( index + 6 ) / 255;
						defaultG = reader.getUint8( index + 7 ) / 255;
						defaultB = reader.getUint8( index + 8 ) / 255;
						alpha = reader.getUint8( index + 9 ) / 255;
					}
				}
				const dataOffset = 84;
				const faceLength = 12 * 4 + 2;
				const geometry = new THREE.BufferGeometry();
				const vertices = new Float32Array( faces * 3 * 3 );
				const normals = new Float32Array( faces * 3 * 3 );
				for ( let face = 0; face < faces; face ++ ) {
					const start = dataOffset + face * faceLength;
					const normalX = reader.getFloat32( start, true );
					const normalY = reader.getFloat32( start + 4, true );
					const normalZ = reader.getFloat32( start + 8, true );
					if ( hasColors ) {
						const packedColor = reader.getUint16( start + 48, true );
						if ( ( packedColor & 0x8000 ) === 0 ) {
							r = ( packedColor & 0x1F ) / 31;
							g = ( packedColor >> 5 & 0x1F ) / 31;
							b = ( packedColor >> 10 & 0x1F ) / 31;
						} else {
							r = defaultR;
							g = defaultG;
							b = defaultB;
						}
					}
					for ( let i = 1; i <= 3; i ++ ) {
						const vertexstart = start + i * 12;
						const componentIdx = face * 3 * 3 + ( i - 1 ) * 3;
						vertices[ componentIdx ] = reader.getFloat32( vertexstart, true );
						vertices[ componentIdx + 1 ] = reader.getFloat32( vertexstart + 4, true );
						vertices[ componentIdx + 2 ] = reader.getFloat32( vertexstart + 8, true );
						normals[ componentIdx ] = normalX;
						normals[ componentIdx + 1 ] = normalY;
						normals[ componentIdx + 2 ] = normalZ;
						if ( hasColors ) {
							colors[ componentIdx ] = r;
							colors[ componentIdx + 1 ] = g;
							colors[ componentIdx + 2 ] = b;
						}
					}
				}
				geometry.setAttribute( 'position', new THREE.BufferAttribute( vertices, 3 ) );
				geometry.setAttribute( 'normal', new THREE.BufferAttribute( normals, 3 ) );
				if ( hasColors ) {
					geometry.setAttribute( 'color', new THREE.BufferAttribute( colors, 3 ) );
					geometry.hasColors = true;
					geometry.alpha = alpha;
				}
				return geometry;
			}
			function parseASCII( data ) {
				const geometry = new THREE.BufferGeometry();
				const patternSolid = /solid([\s\S]*?)endsolid/g;
				const patternFace = /facet([\s\S]*?)endfacet/g;
				let faceCounter = 0;
				const patternFloat = /[\s]+([+-]?(?:\d*)(?:\.\d*)?(?:[eE][+-]?\d+)?)/.source;
				const patternVertex = new RegExp( 'vertex' + patternFloat + patternFloat + patternFloat, 'g' );
				const patternNormal = new RegExp( 'normal' + patternFloat + patternFloat + patternFloat, 'g' );
				const vertices = [];
				const normals = [];
				const normal = new THREE.Vector3();
				let result;
				let groupCount = 0;
				let startVertex = 0;
				let endVertex = 0;
				while ( ( result = patternSolid.exec( data ) ) !== null ) {
					startVertex = endVertex;
					const solid = result[ 0 ];
					while ( ( result = patternFace.exec( solid ) ) !== null ) {
						let vertexCountPerFace = 0;
						let normalCountPerFace = 0;
						const text = result[ 0 ];
						while ( ( result = patternNormal.exec( text ) ) !== null ) {
							normal.x = parseFloat( result[ 1 ] );
							normal.y = parseFloat( result[ 2 ] );
							normal.z = parseFloat( result[ 3 ] );
							normalCountPerFace ++;
						}
						while ( ( result = patternVertex.exec( text ) ) !== null ) {
							vertices.push( parseFloat( result[ 1 ] ), parseFloat( result[ 2 ] ), parseFloat( result[ 3 ] ) );
							normals.push( normal.x, normal.y, normal.z );
							vertexCountPerFace ++;
							endVertex ++;
						}
						if ( normalCountPerFace !== 1 ) {
							console.error( 'THREE.STLLoader: Something isn\'t right with the normal of face number ' + faceCounter );
						}
						if ( vertexCountPerFace !== 3 ) {
							console.error( 'THREE.STLLoader: Something isn\'t right with the vertices of face number ' + faceCounter );
						}
						faceCounter ++;
					}
					const start = startVertex;
					const count = endVertex - startVertex;
					geometry.addGroup( start, count, groupCount );
					groupCount ++;
				}
				geometry.setAttribute( 'position', new THREE.Float32BufferAttribute( vertices, 3 ) );
				geometry.setAttribute( 'normal', new THREE.Float32BufferAttribute( normals, 3 ) );
				return geometry;
			}
			function ensureString( buffer ) {
				if ( typeof buffer !== 'string' ) {
					return THREE.LoaderUtils.decodeText( new Uint8Array( buffer ) );
				}
				return buffer;
			}
			function ensureBinary( buffer ) {
				if ( typeof buffer === 'string' ) {
					const array_buffer = new Uint8Array( buffer.length );
					for ( let i = 0; i < buffer.length; i ++ ) {
						array_buffer[ i ] = buffer.charCodeAt( i ) & 0xff;
					}
					return array_buffer.buffer || array_buffer;
				} else {
					return buffer;
				}
			}
			const binData = ensureBinary( data );
			return isBinary( binData ) ? parseBinary( binData ) : parseASCII( ensureString( data ) );
		}
	}
	THREE.STLLoader = STLLoader;
} )();
( function () {
	class GLTFExporter {
		constructor() {
			this.pluginCallbacks = [];
			this.register( function ( writer ) {
				return new GLTFLightExtension( writer );
			} );
			this.register( function ( writer ) {
				return new GLTFMaterialsUnlitExtension( writer );
			} );
			this.register( function ( writer ) {
				return new GLTFMaterialsPBRSpecularGlossiness( writer );
			} );
		}
		register( callback ) {
			if ( this.pluginCallbacks.indexOf( callback ) === - 1 ) {
				this.pluginCallbacks.push( callback );
			}
			return this;
		}
		unregister( callback ) {
			if ( this.pluginCallbacks.indexOf( callback ) !== - 1 ) {
				this.pluginCallbacks.splice( this.pluginCallbacks.indexOf( callback ), 1 );
			}
			return this;
		}
		parse( input, onDone, options ) {
			const writer = new GLTFWriter();
			const plugins = [];
			for ( let i = 0, il = this.pluginCallbacks.length; i < il; i ++ ) {
				plugins.push( this.pluginCallbacks[ i ]( writer ) );
			}
			writer.setPlugins( plugins );
			writer.write( input, onDone, options );
		}
	}
	const WEBGL_CONSTANTS = {
		POINTS: 0x0000,
		LINES: 0x0001,
		LINE_LOOP: 0x0002,
		LINE_STRIP: 0x0003,
		TRIANGLES: 0x0004,
		TRIANGLE_STRIP: 0x0005,
		TRIANGLE_FAN: 0x0006,
		UNSIGNED_BYTE: 0x1401,
		UNSIGNED_SHORT: 0x1403,
		FLOAT: 0x1406,
		UNSIGNED_INT: 0x1405,
		ARRAY_BUFFER: 0x8892,
		ELEMENT_ARRAY_BUFFER: 0x8893,
		NEAREST: 0x2600,
		LINEAR: 0x2601,
		NEAREST_MIPMAP_NEAREST: 0x2700,
		LINEAR_MIPMAP_NEAREST: 0x2701,
		NEAREST_MIPMAP_LINEAR: 0x2702,
		LINEAR_MIPMAP_LINEAR: 0x2703,
		CLAMP_TO_EDGE: 33071,
		MIRRORED_REPEAT: 33648,
		REPEAT: 10497
	};
	const THREE_TO_WEBGL = {};
	THREE_TO_WEBGL[ THREE.NearestFilter ] = WEBGL_CONSTANTS.NEAREST;
	THREE_TO_WEBGL[ THREE.NearestMipmapNearestFilter ] = WEBGL_CONSTANTS.NEAREST_MIPMAP_NEAREST;
	THREE_TO_WEBGL[ THREE.NearestMipmapLinearFilter ] = WEBGL_CONSTANTS.NEAREST_MIPMAP_LINEAR;
	THREE_TO_WEBGL[ THREE.LinearFilter ] = WEBGL_CONSTANTS.LINEAR;
	THREE_TO_WEBGL[ THREE.LinearMipmapNearestFilter ] = WEBGL_CONSTANTS.LINEAR_MIPMAP_NEAREST;
	THREE_TO_WEBGL[ THREE.LinearMipmapLinearFilter ] = WEBGL_CONSTANTS.LINEAR_MIPMAP_LINEAR;
	THREE_TO_WEBGL[ THREE.ClampToEdgeWrapping ] = WEBGL_CONSTANTS.CLAMP_TO_EDGE;
	THREE_TO_WEBGL[ THREE.RepeatWrapping ] = WEBGL_CONSTANTS.REPEAT;
	THREE_TO_WEBGL[ THREE.MirroredRepeatWrapping ] = WEBGL_CONSTANTS.MIRRORED_REPEAT;
	const PATH_PROPERTIES = {
		scale: 'scale',
		position: 'translation',
		quaternion: 'rotation',
		morphTargetInfluences: 'weights'
	};
	const GLB_HEADER_BYTES = 12;
	const GLB_HEADER_MAGIC = 0x46546C67;
	const GLB_VERSION = 2;
	const GLB_CHUNK_PREFIX_BYTES = 8;
	const GLB_CHUNK_TYPE_JSON = 0x4E4F534A;
	const GLB_CHUNK_TYPE_BIN = 0x004E4942;
	function equalArray( array1, array2 ) {
		return array1.length === array2.length && array1.every( function ( element, index ) {
			return element === array2[ index ];
		} );
	}
	function stringToArrayBuffer( text ) {
		if ( window.TextEncoder !== undefined ) {
			return new TextEncoder().encode( text ).buffer;
		}
		const array = new Uint8Array( new ArrayBuffer( text.length ) );
		for ( let i = 0, il = text.length; i < il; i ++ ) {
			const value = text.charCodeAt( i );
			array[ i ] = value > 0xFF ? 0x20 : value;
		}
		return array.buffer;
	}
	function isIdentityMatrix( matrix ) {
		return equalArray( matrix.elements, [ 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1 ] );
	}
	function getMinMax( attribute, start, count ) {
		const output = {
			min: new Array( attribute.itemSize ).fill( Number.POSITIVE_INFINITY ),
			max: new Array( attribute.itemSize ).fill( Number.NEGATIVE_INFINITY )
		};
		for ( let i = start; i < start + count; i ++ ) {
			for ( let a = 0; a < attribute.itemSize; a ++ ) {
				let value;
				if ( attribute.itemSize > 4 ) {
					value = attribute.array[ i * attribute.itemSize + a ];
				} else {
					if ( a === 0 ) value = attribute.getX( i ); else if ( a === 1 ) value = attribute.getY( i ); else if ( a === 2 ) value = attribute.getZ( i ); else if ( a === 3 ) value = attribute.getW( i );
				}
				output.min[ a ] = Math.min( output.min[ a ], value );
				output.max[ a ] = Math.max( output.max[ a ], value );
			}
		}
		return output;
	}
	function getPaddedBufferSize( bufferSize ) {
		return Math.ceil( bufferSize / 4 ) * 4;
	}
	function getPaddedArrayBuffer( arrayBuffer, paddingByte = 0 ) {
		const paddedLength = getPaddedBufferSize( arrayBuffer.byteLength );
		if ( paddedLength !== arrayBuffer.byteLength ) {
			const array = new Uint8Array( paddedLength );
			array.set( new Uint8Array( arrayBuffer ) );
			if ( paddingByte !== 0 ) {
				for ( let i = arrayBuffer.byteLength; i < paddedLength; i ++ ) {
					array[ i ] = paddingByte;
				}
			}
			return array.buffer;
		}
		return arrayBuffer;
	}
	let cachedCanvas = null;
	class GLTFWriter {
		constructor() {
			this.plugins = [];
			this.options = {};
			this.pending = [];
			this.buffers = [];
			this.byteOffset = 0;
			this.buffers = [];
			this.nodeMap = new Map();
			this.skins = [];
			this.extensionsUsed = {};
			this.uids = new Map();
			this.uid = 0;
			this.json = {
				asset: {
					version: '2.0',
					generator: 'THREE.GLTFExporter'
				}
			};
			this.cache = {
				meshes: new Map(),
				attributes: new Map(),
				attributesNormalized: new Map(),
				materials: new Map(),
				textures: new Map(),
				images: new Map()
			};
		}
		setPlugins( plugins ) {
			this.plugins = plugins;
		}
		write( input, onDone, options ) {
			this.options = Object.assign( {}, {
				binary: false,
				trs: false,
				onlyVisible: true,
				truncateDrawRange: true,
				embedImages: true,
				maxTextureSize: Infinity,
				animations: [],
				includeCustomExtensions: false
			}, options );
			if ( this.options.animations.length > 0 ) {
				this.options.trs = true;
			}
			this.processInput( input );
			const writer = this;
			Promise.all( this.pending ).then( function () {
				const buffers = writer.buffers;
				const json = writer.json;
				const options = writer.options;
				const extensionsUsed = writer.extensionsUsed;
				const blob = new Blob( buffers, {
					type: 'application/octet-stream'
				} );
				const extensionsUsedList = Object.keys( extensionsUsed );
				if ( extensionsUsedList.length > 0 ) json.extensionsUsed = extensionsUsedList;
				if ( json.buffers && json.buffers.length > 0 ) json.buffers[ 0 ].byteLength = blob.size;
				if ( options.binary === true ) {
					const reader = new window.FileReader();
					reader.readAsArrayBuffer( blob );
					reader.onloadend = function () {
						const binaryChunk = getPaddedArrayBuffer( reader.result );
						const binaryChunkPrefix = new DataView( new ArrayBuffer( GLB_CHUNK_PREFIX_BYTES ) );
						binaryChunkPrefix.setUint32( 0, binaryChunk.byteLength, true );
						binaryChunkPrefix.setUint32( 4, GLB_CHUNK_TYPE_BIN, true );
						const jsonChunk = getPaddedArrayBuffer( stringToArrayBuffer( JSON.stringify( json ) ), 0x20 );
						const jsonChunkPrefix = new DataView( new ArrayBuffer( GLB_CHUNK_PREFIX_BYTES ) );
						jsonChunkPrefix.setUint32( 0, jsonChunk.byteLength, true );
						jsonChunkPrefix.setUint32( 4, GLB_CHUNK_TYPE_JSON, true );
						const header = new ArrayBuffer( GLB_HEADER_BYTES );
						const headerView = new DataView( header );
						headerView.setUint32( 0, GLB_HEADER_MAGIC, true );
						headerView.setUint32( 4, GLB_VERSION, true );
						const totalByteLength = GLB_HEADER_BYTES + jsonChunkPrefix.byteLength + jsonChunk.byteLength + binaryChunkPrefix.byteLength + binaryChunk.byteLength;
						headerView.setUint32( 8, totalByteLength, true );
						const glbBlob = new Blob( [ header, jsonChunkPrefix, jsonChunk, binaryChunkPrefix, binaryChunk ], {
							type: 'application/octet-stream'
						} );
						const glbReader = new window.FileReader();
						glbReader.readAsArrayBuffer( glbBlob );
						glbReader.onloadend = function () {
							onDone( glbReader.result );
						};
					};
				} else {
					if ( json.buffers && json.buffers.length > 0 ) {
						const reader = new window.FileReader();
						reader.readAsDataURL( blob );
						reader.onloadend = function () {
							const base64data = reader.result;
							json.buffers[ 0 ].uri = base64data;
							onDone( json );
						};
					} else {
						onDone( json );
					}
				}
			} );
		}
		serializeUserData( object, objectDef ) {
			if ( Object.keys( object.userData ).length === 0 ) return;
			const options = this.options;
			const extensionsUsed = this.extensionsUsed;
			try {
				const json = JSON.parse( JSON.stringify( object.userData ) );
				if ( options.includeCustomExtensions && json.gltfExtensions ) {
					if ( objectDef.extensions === undefined ) objectDef.extensions = {};
					for ( const extensionName in json.gltfExtensions ) {
						objectDef.extensions[ extensionName ] = json.gltfExtensions[ extensionName ];
						extensionsUsed[ extensionName ] = true;
					}
					delete json.gltfExtensions;
				}
				if ( Object.keys( json ).length > 0 ) objectDef.extras = json;
			} catch ( error ) {
				console.warn( 'THREE.GLTFExporter: userData of \'' + object.name + '\' ' + 'won\'t be serialized because of JSON.stringify error - ' + error.message );
			}
		}
		getUID( object ) {
			if ( ! this.uids.has( object ) ) this.uids.set( object, this.uid ++ );
			return this.uids.get( object );
		}
		isNormalizedNormalAttribute( normal ) {
			const cache = this.cache;
			if ( cache.attributesNormalized.has( normal ) ) return false;
			const v = new THREE.Vector3();
			for ( let i = 0, il = normal.count; i < il; i ++ ) {
				if ( Math.abs( v.fromBufferAttribute( normal, i ).length() - 1.0 ) > 0.0005 ) return false;
			}
			return true;
		}
		createNormalizedNormalAttribute( normal ) {
			const cache = this.cache;
			if ( cache.attributesNormalized.has( normal ) ) return cache.attributesNormalized.get( normal );
			const attribute = normal.clone();
			const v = new THREE.Vector3();
			for ( let i = 0, il = attribute.count; i < il; i ++ ) {
				v.fromBufferAttribute( attribute, i );
				if ( v.x === 0 && v.y === 0 && v.z === 0 ) {
					v.setX( 1.0 );
				} else {
					v.normalize();
				}
				attribute.setXYZ( i, v.x, v.y, v.z );
			}
			cache.attributesNormalized.set( normal, attribute );
			return attribute;
		}
		applyTextureTransform( mapDef, texture ) {
			let didTransform = false;
			const transformDef = {};
			if ( texture.offset.x !== 0 || texture.offset.y !== 0 ) {
				transformDef.offset = texture.offset.toArray();
				didTransform = true;
			}
			if ( texture.rotation !== 0 ) {
				transformDef.rotation = texture.rotation;
				didTransform = true;
			}
			if ( texture.repeat.x !== 1 || texture.repeat.y !== 1 ) {
				transformDef.scale = texture.repeat.toArray();
				didTransform = true;
			}
			if ( didTransform ) {
				mapDef.extensions = mapDef.extensions || {};
				mapDef.extensions[ 'KHR_texture_transform' ] = transformDef;
				this.extensionsUsed[ 'KHR_texture_transform' ] = true;
			}
		}
		processBuffer( buffer ) {
			const json = this.json;
			const buffers = this.buffers;
			if ( ! json.buffers ) json.buffers = [ {
				byteLength: 0
			} ];
			buffers.push( buffer );
			return 0;
		}
		processBufferView( attribute, componentType, start, count, target ) {
			const json = this.json;
			if ( ! json.bufferViews ) json.bufferViews = [];
			let componentSize;
			if ( componentType === WEBGL_CONSTANTS.UNSIGNED_BYTE ) {
				componentSize = 1;
			} else if ( componentType === WEBGL_CONSTANTS.UNSIGNED_SHORT ) {
				componentSize = 2;
			} else {
				componentSize = 4;
			}
			const byteLength = getPaddedBufferSize( count * attribute.itemSize * componentSize );
			const dataView = new DataView( new ArrayBuffer( byteLength ) );
			let offset = 0;
			for ( let i = start; i < start + count; i ++ ) {
				for ( let a = 0; a < attribute.itemSize; a ++ ) {
					let value;
					if ( attribute.itemSize > 4 ) {
						value = attribute.array[ i * attribute.itemSize + a ];
					} else {
						if ( a === 0 ) value = attribute.getX( i ); else if ( a === 1 ) value = attribute.getY( i ); else if ( a === 2 ) value = attribute.getZ( i ); else if ( a === 3 ) value = attribute.getW( i );
					}
					if ( componentType === WEBGL_CONSTANTS.FLOAT ) {
						dataView.setFloat32( offset, value, true );
					} else if ( componentType === WEBGL_CONSTANTS.UNSIGNED_INT ) {
						dataView.setUint32( offset, value, true );
					} else if ( componentType === WEBGL_CONSTANTS.UNSIGNED_SHORT ) {
						dataView.setUint16( offset, value, true );
					} else if ( componentType === WEBGL_CONSTANTS.UNSIGNED_BYTE ) {
						dataView.setUint8( offset, value );
					}
					offset += componentSize;
				}
			}
			const bufferViewDef = {
				buffer: this.processBuffer( dataView.buffer ),
				byteOffset: this.byteOffset,
				byteLength: byteLength
			};
			if ( target !== undefined ) bufferViewDef.target = target;
			if ( target === WEBGL_CONSTANTS.ARRAY_BUFFER ) {
				bufferViewDef.byteStride = attribute.itemSize * componentSize;
			}
			this.byteOffset += byteLength;
			json.bufferViews.push( bufferViewDef );
			const output = {
				id: json.bufferViews.length - 1,
				byteLength: 0
			};
			return output;
		}
		processBufferViewImage( blob ) {
			const writer = this;
			const json = writer.json;
			if ( ! json.bufferViews ) json.bufferViews = [];
			return new Promise( function ( resolve ) {
				const reader = new window.FileReader();
				reader.readAsArrayBuffer( blob );
				reader.onloadend = function () {
					const buffer = getPaddedArrayBuffer( reader.result );
					const bufferViewDef = {
						buffer: writer.processBuffer( buffer ),
						byteOffset: writer.byteOffset,
						byteLength: buffer.byteLength
					};
					writer.byteOffset += buffer.byteLength;
					resolve( json.bufferViews.push( bufferViewDef ) - 1 );
				};
			} );
		}
		processAccessor( attribute, geometry, start, count ) {
			const options = this.options;
			const json = this.json;
			const types = {
				1: 'SCALAR',
				2: 'VEC2',
				3: 'VEC3',
				4: 'VEC4',
				16: 'MAT4'
			};
			let componentType;
			if ( attribute.array.constructor === Float32Array ) {
				componentType = WEBGL_CONSTANTS.FLOAT;
			} else if ( attribute.array.constructor === Uint32Array ) {
				componentType = WEBGL_CONSTANTS.UNSIGNED_INT;
			} else if ( attribute.array.constructor === Uint16Array ) {
				componentType = WEBGL_CONSTANTS.UNSIGNED_SHORT;
			} else if ( attribute.array.constructor === Uint8Array ) {
				componentType = WEBGL_CONSTANTS.UNSIGNED_BYTE;
			} else {
				throw new Error( 'THREE.GLTFExporter: Unsupported bufferAttribute component type.' );
			}
			if ( start === undefined ) start = 0;
			if ( count === undefined ) count = attribute.count;
			if ( options.truncateDrawRange && geometry !== undefined && geometry.index === null ) {
				const end = start + count;
				const end2 = geometry.drawRange.count === Infinity ? attribute.count : geometry.drawRange.start + geometry.drawRange.count;
				start = Math.max( start, geometry.drawRange.start );
				count = Math.min( end, end2 ) - start;
				if ( count < 0 ) count = 0;
			}
			if ( count === 0 ) return null;
			const minMax = getMinMax( attribute, start, count );
			let bufferViewTarget;
			if ( geometry !== undefined ) {
				bufferViewTarget = attribute === geometry.index ? WEBGL_CONSTANTS.ELEMENT_ARRAY_BUFFER : WEBGL_CONSTANTS.ARRAY_BUFFER;
			}
			const bufferView = this.processBufferView( attribute, componentType, start, count, bufferViewTarget );
			const accessorDef = {
				bufferView: bufferView.id,
				byteOffset: bufferView.byteOffset,
				componentType: componentType,
				count: count,
				max: minMax.max,
				min: minMax.min,
				type: types[ attribute.itemSize ]
			};
			if ( attribute.normalized === true ) accessorDef.normalized = true;
			if ( ! json.accessors ) json.accessors = [];
			return json.accessors.push( accessorDef ) - 1;
		}
		processImage( image, format, flipY ) {
			const writer = this;
			const cache = writer.cache;
			const json = writer.json;
			const options = writer.options;
			const pending = writer.pending;
			if ( ! cache.images.has( image ) ) cache.images.set( image, {} );
			const cachedImages = cache.images.get( image );
			const mimeType = format === THREE.RGBAFormat ? 'image/png' : 'image/jpeg';
			const key = mimeType + ':flipY/' + flipY.toString();
			if ( cachedImages[ key ] !== undefined ) return cachedImages[ key ];
			if ( ! json.images ) json.images = [];
			const imageDef = {
				mimeType: mimeType
			};
			if ( options.embedImages ) {
				const canvas = cachedCanvas = cachedCanvas || document.createElement( 'canvas' );
				canvas.width = Math.min( image.width, options.maxTextureSize );
				canvas.height = Math.min( image.height, options.maxTextureSize );
				const ctx = canvas.getContext( '2d' );
				if ( flipY === true ) {
					ctx.translate( 0, canvas.height );
					ctx.scale( 1, - 1 );
				}
				if ( typeof HTMLImageElement !== 'undefined' && image instanceof HTMLImageElement || typeof HTMLCanvasElement !== 'undefined' && image instanceof HTMLCanvasElement || typeof OffscreenCanvas !== 'undefined' && image instanceof OffscreenCanvas || typeof ImageBitmap !== 'undefined' && image instanceof ImageBitmap ) {
					ctx.drawImage( image, 0, 0, canvas.width, canvas.height );
				} else {
					if ( format !== THREE.RGBAFormat && format !== THREE.RGBFormat ) {
						console.error( 'GLTFExporter: Only RGB and RGBA formats are supported.' );
					}
					if ( image.width > options.maxTextureSize || image.height > options.maxTextureSize ) {
						console.warn( 'GLTFExporter: Image size is bigger than maxTextureSize', image );
					}
					let data = image.data;
					if ( format === THREE.RGBFormat ) {
						data = new Uint8ClampedArray( image.height * image.width * 4 );
						for ( let i = 0, j = 0; i < data.length; i += 4, j += 3 ) {
							data[ i + 0 ] = image.data[ j + 0 ];
							data[ i + 1 ] = image.data[ j + 1 ];
							data[ i + 2 ] = image.data[ j + 2 ];
							data[ i + 3 ] = 255;
						}
					}
					ctx.putImageData( new ImageData( data, image.width, image.height ), 0, 0 );
				}
				if ( options.binary === true ) {
					pending.push( new Promise( function ( resolve ) {
						canvas.toBlob( function ( blob ) {
							writer.processBufferViewImage( blob ).then( function ( bufferViewIndex ) {
								imageDef.bufferView = bufferViewIndex;
								resolve();
							} );
						}, mimeType );
					} ) );
				} else {
					imageDef.uri = canvas.toDataURL( mimeType );
				}
			} else {
				imageDef.uri = image.src;
			}
			const index = json.images.push( imageDef ) - 1;
			cachedImages[ key ] = index;
			return index;
		}
		processSampler( map ) {
			const json = this.json;
			if ( ! json.samplers ) json.samplers = [];
			const samplerDef = {
				magFilter: THREE_TO_WEBGL[ map.magFilter ],
				minFilter: THREE_TO_WEBGL[ map.minFilter ],
				wrapS: THREE_TO_WEBGL[ map.wrapS ],
				wrapT: THREE_TO_WEBGL[ map.wrapT ]
			};
			return json.samplers.push( samplerDef ) - 1;
		}
		processTexture( map ) {
			const cache = this.cache;
			const json = this.json;
			if ( cache.textures.has( map ) ) return cache.textures.get( map );
			if ( ! json.textures ) json.textures = [];
			const textureDef = {
				sampler: this.processSampler( map ),
				source: this.processImage( map.image, map.format, map.flipY )
			};
			if ( map.name ) textureDef.name = map.name;
			this._invokeAll( function ( ext ) {
				ext.writeTexture && ext.writeTexture( map, textureDef );
			} );
			const index = json.textures.push( textureDef ) - 1;
			cache.textures.set( map, index );
			return index;
		}
		processMaterial( material ) {
			const cache = this.cache;
			const json = this.json;
			if ( cache.materials.has( material ) ) return cache.materials.get( material );
			if ( material.isShaderMaterial ) {
				console.warn( 'GLTFExporter: THREE.ShaderMaterial not supported.' );
				return null;
			}
			if ( ! json.materials ) json.materials = [];
			const materialDef = {
				pbrMetallicRoughness: {}
			};
			if ( material.isMeshStandardMaterial !== true && material.isMeshBasicMaterial !== true ) {
				console.warn( 'GLTFExporter: Use MeshStandardMaterial or MeshBasicMaterial for best results.' );
			}
			const color = material.color.toArray().concat( [ material.opacity ] );
			if ( ! equalArray( color, [ 1, 1, 1, 1 ] ) ) {
				materialDef.pbrMetallicRoughness.baseColorFactor = color;
			}
			if ( material.isMeshStandardMaterial ) {
				materialDef.pbrMetallicRoughness.metallicFactor = material.metalness;
				materialDef.pbrMetallicRoughness.roughnessFactor = material.roughness;
			} else {
				materialDef.pbrMetallicRoughness.metallicFactor = 0.5;
				materialDef.pbrMetallicRoughness.roughnessFactor = 0.5;
			}
			if ( material.metalnessMap || material.roughnessMap ) {
				if ( material.metalnessMap === material.roughnessMap ) {
					const metalRoughMapDef = {
						index: this.processTexture( material.metalnessMap )
					};
					this.applyTextureTransform( metalRoughMapDef, material.metalnessMap );
					materialDef.pbrMetallicRoughness.metallicRoughnessTexture = metalRoughMapDef;
				} else {
					console.warn( 'THREE.GLTFExporter: Ignoring metalnessMap and roughnessMap because they are not the same Texture.' );
				}
			}
			if ( material.map ) {
				const baseColorMapDef = {
					index: this.processTexture( material.map )
				};
				this.applyTextureTransform( baseColorMapDef, material.map );
				materialDef.pbrMetallicRoughness.baseColorTexture = baseColorMapDef;
			}
			if ( material.emissive ) {
				const emissive = material.emissive.clone().multiplyScalar( material.emissiveIntensity ).toArray();
				if ( ! equalArray( emissive, [ 0, 0, 0 ] ) ) {
					materialDef.emissiveFactor = emissive;
				}
				if ( material.emissiveMap ) {
					const emissiveMapDef = {
						index: this.processTexture( material.emissiveMap )
					};
					this.applyTextureTransform( emissiveMapDef, material.emissiveMap );
					materialDef.emissiveTexture = emissiveMapDef;
				}
			}
			if ( material.normalMap ) {
				const normalMapDef = {
					index: this.processTexture( material.normalMap )
				};
				if ( material.normalScale && material.normalScale.x !== - 1 ) {
					if ( material.normalScale.x !== material.normalScale.y ) {
						console.warn( 'THREE.GLTFExporter: Normal scale components are different, ignoring Y and exporting X.' );
					}
					normalMapDef.scale = material.normalScale.x;
				}
				this.applyTextureTransform( normalMapDef, material.normalMap );
				materialDef.normalTexture = normalMapDef;
			}
			if ( material.aoMap ) {
				const occlusionMapDef = {
					index: this.processTexture( material.aoMap ),
					texCoord: 1
				};
				if ( material.aoMapIntensity !== 1.0 ) {
					occlusionMapDef.strength = material.aoMapIntensity;
				}
				this.applyTextureTransform( occlusionMapDef, material.aoMap );
				materialDef.occlusionTexture = occlusionMapDef;
			}
			if ( material.transparent ) {
				materialDef.alphaMode = 'BLEND';
			} else {
				if ( material.alphaTest > 0.0 ) {
					materialDef.alphaMode = 'MASK';
					materialDef.alphaCutoff = material.alphaTest;
				}
			}
			if ( material.side === THREE.DoubleSide ) materialDef.doubleSided = true;
			if ( material.name !== '' ) materialDef.name = material.name;
			this.serializeUserData( material, materialDef );
			this._invokeAll( function ( ext ) {
				ext.writeMaterial && ext.writeMaterial( material, materialDef );
			} );
			const index = json.materials.push( materialDef ) - 1;
			cache.materials.set( material, index );
			return index;
		}
		processMesh( mesh ) {
			const cache = this.cache;
			const json = this.json;
			const meshCacheKeyParts = [ mesh.geometry.uuid ];
			if ( Array.isArray( mesh.material ) ) {
				for ( let i = 0, l = mesh.material.length; i < l; i ++ ) {
					meshCacheKeyParts.push( mesh.material[ i ].uuid );
				}
			} else {
				meshCacheKeyParts.push( mesh.material.uuid );
			}
			const meshCacheKey = meshCacheKeyParts.join( ':' );
			if ( cache.meshes.has( meshCacheKey ) ) return cache.meshes.get( meshCacheKey );
			const geometry = mesh.geometry;
			let mode;
			if ( mesh.isLineSegments ) {
				mode = WEBGL_CONSTANTS.LINES;
			} else if ( mesh.isLineLoop ) {
				mode = WEBGL_CONSTANTS.LINE_LOOP;
			} else if ( mesh.isLine ) {
				mode = WEBGL_CONSTANTS.LINE_STRIP;
			} else if ( mesh.isPoints ) {
				mode = WEBGL_CONSTANTS.POINTS;
			} else {
				mode = mesh.material.wireframe ? WEBGL_CONSTANTS.LINES : WEBGL_CONSTANTS.TRIANGLES;
			}
			if ( geometry.isBufferGeometry !== true ) {
				throw new Error( 'THREE.GLTFExporter: Geometry is not of type THREE.BufferGeometry.' );
			}
			const meshDef = {};
			const attributes = {};
			const primitives = [];
			const targets = [];
			const nameConversion = {
				uv: 'TEXCOORD_0',
				uv2: 'TEXCOORD_1',
				color: 'COLOR_0',
				skinWeight: 'WEIGHTS_0',
				skinIndex: 'JOINTS_0'
			};
			const originalNormal = geometry.getAttribute( 'normal' );
			if ( originalNormal !== undefined && ! this.isNormalizedNormalAttribute( originalNormal ) ) {
				console.warn( 'THREE.GLTFExporter: Creating normalized normal attribute from the non-normalized one.' );
				geometry.setAttribute( 'normal', this.createNormalizedNormalAttribute( originalNormal ) );
			}
			let modifiedAttribute = null;
			for ( let attributeName in geometry.attributes ) {
				if ( attributeName.substr( 0, 5 ) === 'morph' ) continue;
				const attribute = geometry.attributes[ attributeName ];
				attributeName = nameConversion[ attributeName ] || attributeName.toUpperCase();
				const validVertexAttributes = /^(POSITION|NORMAL|TANGENT|TEXCOORD_\d+|COLOR_\d+|JOINTS_\d+|WEIGHTS_\d+)$/;
				if ( ! validVertexAttributes.test( attributeName ) ) attributeName = '_' + attributeName;
				if ( cache.attributes.has( this.getUID( attribute ) ) ) {
					attributes[ attributeName ] = cache.attributes.get( this.getUID( attribute ) );
					continue;
				}
				modifiedAttribute = null;
				const array = attribute.array;
				if ( attributeName === 'JOINTS_0' && ! ( array instanceof Uint16Array ) && ! ( array instanceof Uint8Array ) ) {
					console.warn( 'GLTFExporter: Attribute "skinIndex" converted to type UNSIGNED_SHORT.' );
					modifiedAttribute = new THREE.BufferAttribute( new Uint16Array( array ), attribute.itemSize, attribute.normalized );
				}
				const accessor = this.processAccessor( modifiedAttribute || attribute, geometry );
				if ( accessor !== null ) {
					attributes[ attributeName ] = accessor;
					cache.attributes.set( this.getUID( attribute ), accessor );
				}
			}
			if ( originalNormal !== undefined ) geometry.setAttribute( 'normal', originalNormal );
			if ( Object.keys( attributes ).length === 0 ) return null;
			if ( mesh.morphTargetInfluences !== undefined && mesh.morphTargetInfluences.length > 0 ) {
				const weights = [];
				const targetNames = [];
				const reverseDictionary = {};
				if ( mesh.morphTargetDictionary !== undefined ) {
					for ( const key in mesh.morphTargetDictionary ) {
						reverseDictionary[ mesh.morphTargetDictionary[ key ] ] = key;
					}
				}
				for ( let i = 0; i < mesh.morphTargetInfluences.length; ++ i ) {
					const target = {};
					let warned = false;
					for ( const attributeName in geometry.morphAttributes ) {
						if ( attributeName !== 'position' && attributeName !== 'normal' ) {
							if ( ! warned ) {
								console.warn( 'GLTFExporter: Only POSITION and NORMAL morph are supported.' );
								warned = true;
							}
							continue;
						}
						const attribute = geometry.morphAttributes[ attributeName ][ i ];
						const gltfAttributeName = attributeName.toUpperCase();
						const baseAttribute = geometry.attributes[ attributeName ];
						if ( cache.attributes.has( this.getUID( attribute ) ) ) {
							target[ gltfAttributeName ] = cache.attributes.get( this.getUID( attribute ) );
							continue;
						}
						const relativeAttribute = attribute.clone();
						if ( ! geometry.morphTargetsRelative ) {
							for ( let j = 0, jl = attribute.count; j < jl; j ++ ) {
								relativeAttribute.setXYZ( j, attribute.getX( j ) - baseAttribute.getX( j ), attribute.getY( j ) - baseAttribute.getY( j ), attribute.getZ( j ) - baseAttribute.getZ( j ) );
							}
						}
						target[ gltfAttributeName ] = this.processAccessor( relativeAttribute, geometry );
						cache.attributes.set( this.getUID( baseAttribute ), target[ gltfAttributeName ] );
					}
					targets.push( target );
					weights.push( mesh.morphTargetInfluences[ i ] );
					if ( mesh.morphTargetDictionary !== undefined ) targetNames.push( reverseDictionary[ i ] );
				}
				meshDef.weights = weights;
				if ( targetNames.length > 0 ) {
					meshDef.extras = {};
					meshDef.extras.targetNames = targetNames;
				}
			}
			const isMultiMaterial = Array.isArray( mesh.material );
			if ( isMultiMaterial && geometry.groups.length === 0 ) return null;
			const materials = isMultiMaterial ? mesh.material : [ mesh.material ];
			const groups = isMultiMaterial ? geometry.groups : [ {
				materialIndex: 0,
				start: undefined,
				count: undefined
			} ];
			for ( let i = 0, il = groups.length; i < il; i ++ ) {
				const primitive = {
					mode: mode,
					attributes: attributes
				};
				this.serializeUserData( geometry, primitive );
				if ( targets.length > 0 ) primitive.targets = targets;
				if ( geometry.index !== null ) {
					let cacheKey = this.getUID( geometry.index );
					if ( groups[ i ].start !== undefined || groups[ i ].count !== undefined ) {
						cacheKey += ':' + groups[ i ].start + ':' + groups[ i ].count;
					}
					if ( cache.attributes.has( cacheKey ) ) {
						primitive.indices = cache.attributes.get( cacheKey );
					} else {
						primitive.indices = this.processAccessor( geometry.index, geometry, groups[ i ].start, groups[ i ].count );
						cache.attributes.set( cacheKey, primitive.indices );
					}
					if ( primitive.indices === null ) delete primitive.indices;
				}
				const material = this.processMaterial( materials[ groups[ i ].materialIndex ] );
				if ( material !== null ) primitive.material = material;
				primitives.push( primitive );
			}
			meshDef.primitives = primitives;
			if ( ! json.meshes ) json.meshes = [];
			this._invokeAll( function ( ext ) {
				ext.writeMesh && ext.writeMesh( mesh, meshDef );
			} );
			const index = json.meshes.push( meshDef ) - 1;
			cache.meshes.set( meshCacheKey, index );
			return index;
		}
		processCamera( camera ) {
			const json = this.json;
			if ( ! json.cameras ) json.cameras = [];
			const isOrtho = camera.isOrthographicCamera;
			const cameraDef = {
				type: isOrtho ? 'orthographic' : 'perspective'
			};
			if ( isOrtho ) {
				cameraDef.orthographic = {
					xmag: camera.right * 2,
					ymag: camera.top * 2,
					zfar: camera.far <= 0 ? 0.001 : camera.far,
					znear: camera.near < 0 ? 0 : camera.near
				};
			} else {
				cameraDef.perspective = {
					aspectRatio: camera.aspect,
					yfov: THREE.MathUtils.degToRad( camera.fov ),
					zfar: camera.far <= 0 ? 0.001 : camera.far,
					znear: camera.near < 0 ? 0 : camera.near
				};
			}
			if ( camera.name !== '' ) cameraDef.name = camera.type;
			return json.cameras.push( cameraDef ) - 1;
		}
		processAnimation( clip, root ) {
			const json = this.json;
			const nodeMap = this.nodeMap;
			if ( ! json.animations ) json.animations = [];
			clip = GLTFExporter.Utils.mergeMorphTargetTracks( clip.clone(), root );
			const tracks = clip.tracks;
			const channels = [];
			const samplers = [];
			for ( let i = 0; i < tracks.length; ++ i ) {
				const track = tracks[ i ];
				const trackBinding = THREE.PropertyBinding.parseTrackName( track.name );
				let trackNode = THREE.PropertyBinding.findNode( root, trackBinding.nodeName );
				const trackProperty = PATH_PROPERTIES[ trackBinding.propertyName ];
				if ( trackBinding.objectName === 'bones' ) {
					if ( trackNode.isSkinnedMesh === true ) {
						trackNode = trackNode.skeleton.getBoneByName( trackBinding.objectIndex );
					} else {
						trackNode = undefined;
					}
				}
				if ( ! trackNode || ! trackProperty ) {
					console.warn( 'THREE.GLTFExporter: Could not export animation track "%s".', track.name );
					return null;
				}
				const inputItemSize = 1;
				let outputItemSize = track.values.length / track.times.length;
				if ( trackProperty === PATH_PROPERTIES.morphTargetInfluences ) {
					outputItemSize /= trackNode.morphTargetInfluences.length;
				}
				let interpolation;
				if ( track.createInterpolant.isInterpolantFactoryMethodGLTFCubicSpline === true ) {
					interpolation = 'CUBICSPLINE';
					outputItemSize /= 3;
				} else if ( track.getInterpolation() === THREE.InterpolateDiscrete ) {
					interpolation = 'STEP';
				} else {
					interpolation = 'LINEAR';
				}
				samplers.push( {
					input: this.processAccessor( new THREE.BufferAttribute( track.times, inputItemSize ) ),
					output: this.processAccessor( new THREE.BufferAttribute( track.values, outputItemSize ) ),
					interpolation: interpolation
				} );
				channels.push( {
					sampler: samplers.length - 1,
					target: {
						node: nodeMap.get( trackNode ),
						path: trackProperty
					}
				} );
			}
			json.animations.push( {
				name: clip.name || 'clip_' + json.animations.length,
				samplers: samplers,
				channels: channels
			} );
			return json.animations.length - 1;
		}
		processSkin( object ) {
			const json = this.json;
			const nodeMap = this.nodeMap;
			const node = json.nodes[ nodeMap.get( object ) ];
			const skeleton = object.skeleton;
			if ( skeleton === undefined ) return null;
			const rootJoint = object.skeleton.bones[ 0 ];
			if ( rootJoint === undefined ) return null;
			const joints = [];
			const inverseBindMatrices = new Float32Array( skeleton.bones.length * 16 );
			const temporaryBoneInverse = new THREE.Matrix4();
			for ( let i = 0; i < skeleton.bones.length; ++ i ) {
				joints.push( nodeMap.get( skeleton.bones[ i ] ) );
				temporaryBoneInverse.copy( skeleton.boneInverses[ i ] );
				temporaryBoneInverse.multiply( object.bindMatrix ).toArray( inverseBindMatrices, i * 16 );
			}
			if ( json.skins === undefined ) json.skins = [];
			json.skins.push( {
				inverseBindMatrices: this.processAccessor( new THREE.BufferAttribute( inverseBindMatrices, 16 ) ),
				joints: joints,
				skeleton: nodeMap.get( rootJoint )
			} );
			const skinIndex = node.skin = json.skins.length - 1;
			return skinIndex;
		}
		processNode( object ) {
			const json = this.json;
			const options = this.options;
			const nodeMap = this.nodeMap;
			if ( ! json.nodes ) json.nodes = [];
			const nodeDef = {};
			if ( options.trs ) {
				const rotation = object.quaternion.toArray();
				const position = object.position.toArray();
				const scale = object.scale.toArray();
				if ( ! equalArray( rotation, [ 0, 0, 0, 1 ] ) ) {
					nodeDef.rotation = rotation;
				}
				if ( ! equalArray( position, [ 0, 0, 0 ] ) ) {
					nodeDef.translation = position;
				}
				if ( ! equalArray( scale, [ 1, 1, 1 ] ) ) {
					nodeDef.scale = scale;
				}
			} else {
				if ( object.matrixAutoUpdate ) {
					object.updateMatrix();
				}
				if ( isIdentityMatrix( object.matrix ) === false ) {
					nodeDef.matrix = object.matrix.elements;
				}
			}
			if ( object.name !== '' ) nodeDef.name = String( object.name );
			this.serializeUserData( object, nodeDef );
			if ( object.isMesh || object.isLine || object.isPoints ) {
				const meshIndex = this.processMesh( object );
				if ( meshIndex !== null ) nodeDef.mesh = meshIndex;
			} else if ( object.isCamera ) {
				nodeDef.camera = this.processCamera( object );
			}
			if ( object.isSkinnedMesh ) this.skins.push( object );
			if ( object.children.length > 0 ) {
				const children = [];
				for ( let i = 0, l = object.children.length; i < l; i ++ ) {
					const child = object.children[ i ];
					if ( child.visible || options.onlyVisible === false ) {
						const nodeIndex = this.processNode( child );
						if ( nodeIndex !== null ) children.push( nodeIndex );
					}
				}
				if ( children.length > 0 ) nodeDef.children = children;
			}
			this._invokeAll( function ( ext ) {
				ext.writeNode && ext.writeNode( object, nodeDef );
			} );
			const nodeIndex = json.nodes.push( nodeDef ) - 1;
			nodeMap.set( object, nodeIndex );
			return nodeIndex;
		}
		processScene( scene ) {
			const json = this.json;
			const options = this.options;
			if ( ! json.scenes ) {
				json.scenes = [];
				json.scene = 0;
			}
			const sceneDef = {};
			if ( scene.name !== '' ) sceneDef.name = scene.name;
			json.scenes.push( sceneDef );
			const nodes = [];
			for ( let i = 0, l = scene.children.length; i < l; i ++ ) {
				const child = scene.children[ i ];
				if ( child.visible || options.onlyVisible === false ) {
					const nodeIndex = this.processNode( child );
					if ( nodeIndex !== null ) nodes.push( nodeIndex );
				}
			}
			if ( nodes.length > 0 ) sceneDef.nodes = nodes;
			this.serializeUserData( scene, sceneDef );
		}
		processObjects( objects ) {
			const scene = new THREE.Scene();
			scene.name = 'AuxScene';
			for ( let i = 0; i < objects.length; i ++ ) {
				scene.children.push( objects[ i ] );
			}
			this.processScene( scene );
		}
		processInput( input ) {
			const options = this.options;
			input = input instanceof Array ? input : [ input ];
			this._invokeAll( function ( ext ) {
				ext.beforeParse && ext.beforeParse( input );
			} );
			const objectsWithoutScene = [];
			for ( let i = 0; i < input.length; i ++ ) {
				if ( input[ i ] instanceof THREE.Scene ) {
					this.processScene( input[ i ] );
				} else {
					objectsWithoutScene.push( input[ i ] );
				}
			}
			if ( objectsWithoutScene.length > 0 ) this.processObjects( objectsWithoutScene );
			for ( let i = 0; i < this.skins.length; ++ i ) {
				this.processSkin( this.skins[ i ] );
			}
			for ( let i = 0; i < options.animations.length; ++ i ) {
				this.processAnimation( options.animations[ i ], input[ 0 ] );
			}
			this._invokeAll( function ( ext ) {
				ext.afterParse && ext.afterParse( input );
			} );
		}
		_invokeAll( func ) {
			for ( let i = 0, il = this.plugins.length; i < il; i ++ ) {
				func( this.plugins[ i ] );
			}
		}
	}
	class GLTFLightExtension {
		constructor( writer ) {
			this.writer = writer;
			this.name = 'KHR_lights_punctual';
		}
		writeNode( light, nodeDef ) {
			if ( ! light.isLight ) return;
			if ( ! light.isDirectionalLight && ! light.isPointLight && ! light.isSpotLight ) {
				console.warn( 'THREE.GLTFExporter: Only directional, point, and spot lights are supported.', light );
				return;
			}
			const writer = this.writer;
			const json = writer.json;
			const extensionsUsed = writer.extensionsUsed;
			const lightDef = {};
			if ( light.name ) lightDef.name = light.name;
			lightDef.color = light.color.toArray();
			lightDef.intensity = light.intensity;
			if ( light.isDirectionalLight ) {
				lightDef.type = 'directional';
			} else if ( light.isPointLight ) {
				lightDef.type = 'point';
				if ( light.distance > 0 ) lightDef.range = light.distance;
			} else if ( light.isSpotLight ) {
				lightDef.type = 'spot';
				if ( light.distance > 0 ) lightDef.range = light.distance;
				lightDef.spot = {};
				lightDef.spot.innerConeAngle = ( light.penumbra - 1.0 ) * light.angle * - 1.0;
				lightDef.spot.outerConeAngle = light.angle;
			}
			if ( light.decay !== undefined && light.decay !== 2 ) {
				console.warn( 'THREE.GLTFExporter: Light decay may be lost. glTF is physically-based, ' + 'and expects light.decay=2.' );
			}
			if ( light.target && ( light.target.parent !== light || light.target.position.x !== 0 || light.target.position.y !== 0 || light.target.position.z !== - 1 ) ) {
				console.warn( 'THREE.GLTFExporter: Light direction may be lost. For best results, ' + 'make light.target a child of the light with position 0,0,-1.' );
			}
			if ( ! extensionsUsed[ this.name ] ) {
				json.extensions = json.extensions || {};
				json.extensions[ this.name ] = {
					lights: []
				};
				extensionsUsed[ this.name ] = true;
			}
			const lights = json.extensions[ this.name ].lights;
			lights.push( lightDef );
			nodeDef.extensions = nodeDef.extensions || {};
			nodeDef.extensions[ this.name ] = {
				light: lights.length - 1
			};
		}
	}
	class GLTFMaterialsUnlitExtension {
		constructor( writer ) {
			this.writer = writer;
			this.name = 'KHR_materials_unlit';
		}
		writeMaterial( material, materialDef ) {
			if ( ! material.isMeshBasicMaterial ) return;
			const writer = this.writer;
			const extensionsUsed = writer.extensionsUsed;
			materialDef.extensions = materialDef.extensions || {};
			materialDef.extensions[ this.name ] = {};
			extensionsUsed[ this.name ] = true;
			materialDef.pbrMetallicRoughness.metallicFactor = 0.0;
			materialDef.pbrMetallicRoughness.roughnessFactor = 0.9;
		}
	}
	class GLTFMaterialsPBRSpecularGlossiness {
		constructor( writer ) {
			this.writer = writer;
			this.name = 'KHR_materials_pbrSpecularGlossiness';
		}
		writeMaterial( material, materialDef ) {
			if ( ! material.isGLTFSpecularGlossinessMaterial ) return;
			const writer = this.writer;
			const extensionsUsed = writer.extensionsUsed;
			const extensionDef = {};
			if ( materialDef.pbrMetallicRoughness.baseColorFactor ) {
				extensionDef.diffuseFactor = materialDef.pbrMetallicRoughness.baseColorFactor;
			}
			const specularFactor = [ 1, 1, 1 ];
			material.specular.toArray( specularFactor, 0 );
			extensionDef.specularFactor = specularFactor;
			extensionDef.glossinessFactor = material.glossiness;
			if ( materialDef.pbrMetallicRoughness.baseColorTexture ) {
				extensionDef.diffuseTexture = materialDef.pbrMetallicRoughness.baseColorTexture;
			}
			if ( material.specularMap ) {
				const specularMapDef = {
					index: writer.processTexture( material.specularMap )
				};
				writer.applyTextureTransform( specularMapDef, material.specularMap );
				extensionDef.specularGlossinessTexture = specularMapDef;
			}
			materialDef.extensions = materialDef.extensions || {};
			materialDef.extensions[ this.name ] = extensionDef;
			extensionsUsed[ this.name ] = true;
		}
	}
	GLTFExporter.Utils = {
		insertKeyframe: function ( track, time ) {
			const tolerance = 0.001;
			const valueSize = track.getValueSize();
			const times = new track.TimeBufferType( track.times.length + 1 );
			const values = new track.ValueBufferType( track.values.length + valueSize );
			const interpolant = track.createInterpolant( new track.ValueBufferType( valueSize ) );
			let index;
			if ( track.times.length === 0 ) {
				times[ 0 ] = time;
				for ( let i = 0; i < valueSize; i ++ ) {
					values[ i ] = 0;
				}
				index = 0;
			} else if ( time < track.times[ 0 ] ) {
				if ( Math.abs( track.times[ 0 ] - time ) < tolerance ) return 0;
				times[ 0 ] = time;
				times.set( track.times, 1 );
				values.set( interpolant.evaluate( time ), 0 );
				values.set( track.values, valueSize );
				index = 0;
			} else if ( time > track.times[ track.times.length - 1 ] ) {
				if ( Math.abs( track.times[ track.times.length - 1 ] - time ) < tolerance ) {
					return track.times.length - 1;
				}
				times[ times.length - 1 ] = time;
				times.set( track.times, 0 );
				values.set( track.values, 0 );
				values.set( interpolant.evaluate( time ), track.values.length );
				index = times.length - 1;
			} else {
				for ( let i = 0; i < track.times.length; i ++ ) {
					if ( Math.abs( track.times[ i ] - time ) < tolerance ) return i;
					if ( track.times[ i ] < time && track.times[ i + 1 ] > time ) {
						times.set( track.times.slice( 0, i + 1 ), 0 );
						times[ i + 1 ] = time;
						times.set( track.times.slice( i + 1 ), i + 2 );
						values.set( track.values.slice( 0, ( i + 1 ) * valueSize ), 0 );
						values.set( interpolant.evaluate( time ), ( i + 1 ) * valueSize );
						values.set( track.values.slice( ( i + 1 ) * valueSize ), ( i + 2 ) * valueSize );
						index = i + 1;
						break;
					}
				}
			}
			track.times = times;
			track.values = values;
			return index;
		},
		mergeMorphTargetTracks: function ( clip, root ) {
			const tracks = [];
			const mergedTracks = {};
			const sourceTracks = clip.tracks;
			for ( let i = 0; i < sourceTracks.length; ++ i ) {
				let sourceTrack = sourceTracks[ i ];
				const sourceTrackBinding = THREE.PropertyBinding.parseTrackName( sourceTrack.name );
				const sourceTrackNode = THREE.PropertyBinding.findNode( root, sourceTrackBinding.nodeName );
				if ( sourceTrackBinding.propertyName !== 'morphTargetInfluences' || sourceTrackBinding.propertyIndex === undefined ) {
					tracks.push( sourceTrack );
					continue;
				}
				if ( sourceTrack.createInterpolant !== sourceTrack.InterpolantFactoryMethodDiscrete && sourceTrack.createInterpolant !== sourceTrack.InterpolantFactoryMethodLinear ) {
					if ( sourceTrack.createInterpolant.isInterpolantFactoryMethodGLTFCubicSpline ) {
						throw new Error( 'THREE.GLTFExporter: Cannot merge tracks with glTF CUBICSPLINE interpolation.' );
					}
					console.warn( 'THREE.GLTFExporter: Morph target interpolation mode not yet supported. Using LINEAR instead.' );
					sourceTrack = sourceTrack.clone();
					sourceTrack.setInterpolation( THREE.InterpolateLinear );
				}
				const targetCount = sourceTrackNode.morphTargetInfluences.length;
				const targetIndex = sourceTrackNode.morphTargetDictionary[ sourceTrackBinding.propertyIndex ];
				if ( targetIndex === undefined ) {
					throw new Error( 'THREE.GLTFExporter: Morph target name not found: ' + sourceTrackBinding.propertyIndex );
				}
				let mergedTrack;
				if ( mergedTracks[ sourceTrackNode.uuid ] === undefined ) {
					mergedTrack = sourceTrack.clone();
					const values = new mergedTrack.ValueBufferType( targetCount * mergedTrack.times.length );
					for ( let j = 0; j < mergedTrack.times.length; j ++ ) {
						values[ j * targetCount + targetIndex ] = mergedTrack.values[ j ];
					}
					mergedTrack.name = ( sourceTrackBinding.nodeName || '' ) + '.morphTargetInfluences';
					mergedTrack.values = values;
					mergedTracks[ sourceTrackNode.uuid ] = mergedTrack;
					tracks.push( mergedTrack );
					continue;
				}
				const sourceInterpolant = sourceTrack.createInterpolant( new sourceTrack.ValueBufferType( 1 ) );
				mergedTrack = mergedTracks[ sourceTrackNode.uuid ];
				for ( let j = 0; j < mergedTrack.times.length; j ++ ) {
					mergedTrack.values[ j * targetCount + targetIndex ] = sourceInterpolant.evaluate( mergedTrack.times[ j ] );
				}
				for ( let j = 0; j < sourceTrack.times.length; j ++ ) {
					const keyframeIndex = this.insertKeyframe( mergedTrack, sourceTrack.times[ j ] );
					mergedTrack.values[ keyframeIndex * targetCount + targetIndex ] = sourceTrack.values[ j ];
				}
			}
			clip.tracks = tracks;
			return clip;
		}
	};
	THREE.GLTFExporter = GLTFExporter;
} )();
function meshoptLoad() {
if (meshoptLoad.s) return meshoptLoad.s;
// This file is part of meshoptimizer library and is distributed under the terms of MIT License.
// Copyright (C) 2016-2026, by Arseny Kapoulkine (arseny.kapoulkine@gmail.com)
var MeshoptSimplifier = (function () {
	var wasm =
		'b9H79Tebbbe;veC9Geueu9Geub9Gbb9Gsuuuuuuuuuuuu99uueu9Gvuuuuub9Gruuuuuuub9Gouuuuuue999Gvuuuuueu9Gzuuuuuuuuuuu99uuuub9Gquuuuuuu99uueu9GPuuuuuuuuuuu99uueu9Gquuuuuuuu99ueu9Gruuuuuu99eu9Gwuuuuuu99ueu9Giuuue999GDuuuuuuuuueu9Gkuuuuuuuu99uub9Gluuuueu9Gluuuub9Giuuueui3EdilvorlwDiqkrxmPszdHObAAbeAlve9Weiiviebeoweuecj:Gdkr:Sdmo9TW9T9VV95dbH9F9F939H79T9F9J9H229F9Jt9VV7bbz9TW79O9V9Wt9F79P9T9W29P9M95bw8E9TW79O9V9Wt9F79P9T9W29P9M959x9Pt9OcttV9P9I91tW7bD8A9TW79O9V9Wt9F79P9T9W29P9M959x9Pt9O9v9W9K9HtWbqQ9TW79O9V9Wt9F79P9T9W29P9M959t29V9W9W95bkX9TW79O9V9Wt9F79P9T9W29P9M959qV919UWbmQ9TW79O9V9Wt9F79P9T9W29P9M959q9V9P9Ut7bPX9TW79O9V9Wt9F79P9T9W29P9M959t9J9H2WbsP9TW79O9V9Wt9FVW9TW79Obza9TW79O9V9Wt9F9V9Wt9P9T9P96W9wWVtW94SWt9J9O9sW9T9H9WbA59TW79O9V9Wt9F9NW9UWV9HtW9q9V79Pt9P9V9U9sW9T9H9WbCl79IV9RbXDwebcekdKYq:p:1dElbzOk:Q:tekYue99iuQ99eui99Due99xue9:w998Jjjjjbcj;sb9Rgs8Kjjjjbcbhzasc:Cefcbc;Kbz:xjjjb8AdnabaeSmbabaeadcdtz:wjjjb8AkdnamcdGTmbalcrfci4cbyd;y:L:cjbHjjjjbbhHasc:Cefasyd;8egecdtfaHBdbasaecefBd;8ecbhlcbhednadTmbabheadhOinaHaeydbci4fcb86bbaeclfheaOcufgOmbkcbhlabheadhOinaHaeydbgAci4fgCaCRbbgCceaAcrGgAtV86bbaCcu7aA4ceGalfhlaeclfheaOcufgOmbkcualcdtalcFFFFi0Ehekaecbyd;y:L:cjbHjjjjbbhzasc:Cefasyd;8egecdtfazBdbasaecefBd;8ealcd4alfhOcehHinaHgecethHaeaO6mbkcbhXcuaecdtgOaecFFFFi0Ecbyd;y:L:cjbHjjjjbbhHasc:Cefasyd;8egAcdtfaHBdbasaAcefBd;8eaHcFeaOz:xjjjbhQdnadTmbaecufhLcbhKindndnaQabaKcdtfgYydbgAc:v;t;h;Ev2aLGgOcdtfgCydbgHcuSmbceheinazaHcdtfydbaASmdaOaefhHaecefheaQaHaLGgOcdtfgCydbgHcu9hmbkkazaXcdtfaABdbaCaXBdbaXhHaXcefhXkaYaHBdbaKcefgKad9hmbkkaQcbyd;C:L:cjbH:bjjjbbasasyd;8ecufBd;8ekcbh8AcualcefgecdtaecFFFFi0Ecbyd;y:L:cjbHjjjjbbhKasc:Cefasyd;8egecdtfaKBdbasaKBdNeasaecefBd;8ecuadcitadcFFFFe0Ecbyd;y:L:cjbHjjjjbbhEasc:Cefasyd;8egecdtfaEBdbasaEBd:yeasaecefBd;8eascNefabadalcbz:cjjjbcualcdtgealcFFFFi0Eg3cbyd;y:L:cjbHjjjjbbhHasc:Cefasyd;8egOcdtfaHBdbasaOcefBd;8ea3cbyd;y:L:cjbHjjjjbbhXasc:Cefasyd;8egOcdtfaXBdbasaOcefBd;8eaHaXaialavazasc:Cefz:djjjbalcbyd;y:L:cjbHjjjjbbh5asc:Cefasyd;8egOcdtfa5BdbasaOcefBd;8ea3cbyd;y:L:cjbHjjjjbbhOasc:Cefasyd;8egAcdtfaOBdbasaAcefBd;8ea3cbyd;y:L:cjbHjjjjbbhAasc:Cefasyd;8egCcdtfaABdbasaCcefBd;8eaOcFeaez:xjjjbh8EaAcFeaez:xjjjbh8FdnalTmbindnaKa8AgAcefg8AcdtfydbgCaKaAcdtgefydbgOSmbaCaO9RhYaEaOcitfhaa8Faefhha8EaefhLcbhCindndnaaaCcitfydbgQaA9hmbaLaABdbahaABdbxekdnaKaQcdtggfgeclfydbgOaeydbgeSmbaOae9RhOaEaecitfheinaeydbaASmdaecwfheaOcufgOmbkka8FagfgeaAaQaeydbcuSEBdbaLaQaAaLydbcuSEBdbkaCcefgCaY9hmbkka8Aal9hmbkaHhOaXhAa8EhQa8FhCcbheindndnaeaOydbgL9hmbdnaeaAydbgL9hmbaQydbhLdnaCydbgYcu9hmbaLcu9hmba5aefcb86bbxikdnaYcuSmbaLcuSmbaeaYSmbaHaYcdtfydbaHaLcdtfydb9hmba5aefcd86bbxika5aefhadnaeaYSmbaeaLSmbaace86bbxikaacv86bbxdkdnaeaXaLcdtgYfydb9hmbdnaCydbgacuSmbaeaaSmbaQydbggcuSmbaeagSmba8FaYfydbghcuSmbahaLSmba8EaYfydbgYcuSmbaYaLSmbaHaacdtfydbgLaHaYcdtfydb9hmbaLaHagcdtfydbgYSmbaYaHahcdtfydb9hmba5aefcd86bbxika5aefcv86bbxdka5aefcv86bbxeka5aefa5aLfRbb86bbkaOclfhOaAclfhAaQclfhQaCclfhCalaecefge9hmbkdnamcaGTmbcbh8Jindndna5a8Jfg8KRbbg8Lc9:fPlbeebekdndndnaHa8Jcdtfydbgea8J9hmbcbhYcbh8MaqTmednazTmbcbh8Ma8JheinaqazaecdtgefydbfRbbce4a8MVceGh8MaXaefydbgea8J9hmbxikkcbh8Ma8JheinaqaefRbbce4a8MVceGh8MaXaecdtfydbgea8J9hmbxdkka5aefRbbhexeka8JheindnaKaecdtg8AfgeclfydbgOaeydbgeSmbaOae9RhgaEaecitfhhaHa8AfhacbhLinahaLcitfydbgQhednindnaKaecdtgCfgeclfydbgOaeydbgeSmbaOae9RhOaEaecitfheaaydbhAdninaHaeydbcdtfydbaASmeaecwfheaOcufgOTmdxbkkcbhexdkaXaCfydbgeaQ9hmbkcehekaYaeVhYaLcefgLag9hmbkkaXa8Afydbgea8J9hmbka8LclciaYceGEa8MEheka8Kae86bbka8Jcefg8Jal9hmbkkdnaqTmbdndnazTmbazheaHhOalhAindnaqaeydbfRbbceGTmba5aOydbfcv86bbkaeclfheaOclfhOaAcufgAmbxdkkaqheaHhOalhAindnaeRbbceGTmba5aOydbfcv86bbkaecefheaOclfhOaAcufgAmbkkaHhealhAa5hOindna5aeydbfRbbcv9hmbaOcv86bbkaeclfheaOcefhOaAcufgAmbkkamceGTmba5healhOindndnaeRbbcufPlbeebekaecv86bbkaecefheaOcufgOmbkkcbh8Ncualcx2alc;v:Q;v:Qe0Ecbyd;y:L:cjbHjjjjbbh8Kasc:Cefasyd;8egecdtfa8KBdbasaecefBd;8eascbBd:qeas9cb83i1ea8Kaialavazasc1efz:ejjjbhydndnaDmbcbh8PcbhaxekcbhaawhecbhOindnaeIdbJbbbb9ETmbasaacdtfaOBdbaacefhakaeclfheaDaOcefgO9hmbkcuaaal2gecdtaecFFFFi0Ecbyd;y:L:cjbHjjjjbbh8Pasc:Cefasyd;8egecdtfa8PBdbasaecefBd;8ealTmbdnaambcbhaxekarcd4hgdnazTmbaacdthhcbhLa8PhYinaoazaLcdtfydbag2cdtfhQasheaYhOaahAinaOaQaeydbcdtgCfIdbawaCfIdbNUdbaeclfheaOclfhOaAcufgAmbkaYahfhYaLcefgLal9hmbxdkkaacdthhcbhLa8PhYinaoaLag2cdtfhQasheaYhOaahAinaOaQaeydbcdtgCfIdbawaCfIdbNUdbaeclfheaOclfhOaAcufgAmbkaYahfhYaLcefgLal9hmbkkcualc8S2gOalc;D;O;f8U0EgCcbyd;y:L:cjbHjjjjbbheasc:Cefasyd;8egAcdtfaeBdbasaAcefBd;8eaecbaOz:xjjjbhIcbh8RcbhgdnaaTmbcbh8NaCcbyd;y:L:cjbHjjjjbbhgasc:Cefasyd;8egecdtfagBdbasaecefBd;8eagcbaOz:xjjjb8Acuaaal2gecltgOaecFFFFb0Ecbyd;y:L:cjbHjjjjbbh8Rasc:Cefasyd;8egecdtfa8RBdbasaecefBd;8ea8RcbaOz:xjjjb8AamcjjjjdGTmbcualcltgealcFFFFb0Ecbyd;y:L:cjbHjjjjbbh8Nasc:Cefasyd;8egOcdtfa8NBdbasaOcefBd;8ea8Ncbaez:xjjjb8AkdnadTmbcbhQabhOina8KaOclfydbgLcx2fgeIdba8KaOydbgYcx2fgAIdbg8S:tgRa8KaOcwfydbghcx2fgCIdlaAIdlg8U:tg8VNaeIdla8U:tg8WaCIdba8S:tg8XN:tg8Ya8YNa8WaCIdwaAIdwg8Z:tg80NaeIdwa8Z:tg8Wa8VN:tg81a81Na8Wa8XNaRa80N:tg80a80NMMg8V:rhBa8Yh8Xa80h8Wa81hRdna8VJbbbb9EgATmba8YaB:vh8Xa80aB:vh8Wa81aB:vhRkaIaHaYcdtfydbgCc8S2fgeaRaB:rg8VaRNNg83aeIdbMUdbaea8Wa8Va8WNgUNg85aeIdlMUdlaea8Xa8Va8XNg86Ng87aeIdwMUdwaeaRaUNgUaeIdxMUdxaea86aRNg88aeIdzMUdzaea8Wa86Ng89aeIdCMUdCaeaRa8Va8Xa8ZNaRa8SNa8Ua8WNMM:mg8:Ng86NgRaeIdKMUdKaea8Wa86Ng8WaeId3MUd3aea8Xa86Ng8XaeIdaMUdaaea86a8:Ng86aeId8KMUd8Kaea8VaeIdyMUdyaIaHaLcdtfydbgLc8S2fgea83aeIdbMUdbaea85aeIdlMUdlaea87aeIdwMUdwaeaUaeIdxMUdxaea88aeIdzMUdzaea89aeIdCMUdCaeaRaeIdKMUdKaea8WaeId3MUd3aea8XaeIdaMUdaaea86aeId8KMUd8Kaea8VaeIdyMUdyaIaHahcdtfydbgYc8S2fgea83aeIdbMUdbaea85aeIdlMUdlaea87aeIdwMUdwaeaUaeIdxMUdxaea88aeIdzMUdzaea89aeIdCMUdCaeaRaeIdKMUdKaea8WaeId3MUd3aea8XaeIdaMUdaaea86aeId8KMUd8Kaea8VaeIdyMUdydna8NTmbdnaATmba8YaB:vh8Ya80aB:vh80a81aB:vh81ka8NaCcltfgeaBJbbbZNgRa80Ng8VaeIdlMUdlaeaRa8YNg8WaeIdwMUdwaeaRa81Ng8XaeIdbMUdbaeaRa8S:ma81Na8Ua80N:ta8Za8YN:tNgRaeIdxMUdxa8NaLcltfgea8VaeIdlMUdlaea8WaeIdwMUdwaea8XaeIdbMUdbaeaRaeIdxMUdxa8NaYcltfgea8VaeIdlMUdlaea8WaeIdwMUdwaea8XaeIdbMUdbaeaRaeIdxMUdxkaOcxfhOaQcifgQad6mbkkdnalTmbJq;x8J88J;n;m;m89J:v:;;w8ZamczGEamc;abGEh80cbhOaHhCazhQaIhea8KhAindnaOaCydb9hmbaOhLdnazTmbaQydbhLka80hRdnaqTmbJbbjZa80aqaLfRbbclGEhRkaecxfgLaLIdbJbbbbMUdbaeczfgLaLIdbJbbbbMUdbaecCfgLaLIdbJbbbbMUdbaeaRaecyfgLIdbg8YNgRaeIdbMUdbaeclfgYaRaYIdbMUdbaecwfgYaRaYIdbMUdbaecKfgYaYIdbaAIdbg8WaRN:tUdbaAcwfIdbh8Vaec3fgYaYIdbaRaAclfIdbg8XN:tUdbaecafgYaYIdbaRa8VN:tUdbaec8KfgYIdbh81aLa8YaRMUdbaYa81aRa8Va8VNa8Wa8WNa8Xa8XNMMNMUdbkaCclfhCaQclfhQaec8SfheaAcxfhAalaOcefgO9hmbkkdnadTmbcbh8AabhLinaba8AcdtfhYcbheindna5aLaefydbgCfRbbgOTmba5aYaec:G:G:cjbfydbcdtfydbgQfRbbcFeGgATmbdnaOclSghmbaOci6mbaAclSmbaAcd0mekdnaOcd0mba8EaCcdtfydbaQ9hmekdnaAcd0mba8FaQcdtfydbaC9hmekdndnahmbaAcl9hmekaOciSmeaAciSmekJbbbZJbbbZJbbacaAcdSEaOcdSEhUdna8KaYaec:K:G:cjbfydbcdtfydbcx2fgOIdwa8KaCcx2fgAIdwg86:tg8Sa8KaQcx2fghIdwa86:tg8Xa8XNahIdbaAIdbg8U:tg80a80NahIdlaAIdlg8Z:tg8Va8VNMMg81Na8Xa8Sa8XNaOIdba8U:tg83a80Na8VaOIdla8Z:tg85NMMg8WN:tg8Ya8YNa83a81Na80a8WN:tgRaRNa85a81Na8Va8WN:tg8Wa8WNMMgBJbbbb9ETmba8YaB:rgB:vh8Ya8WaB:vh8WaRaB:vhRkaUa81:rNgBa8Ya86NaRa8UNa8Za8WNMM:mg81Ng87a81Nh88a80a85Na8Va83N:tg81a81Na8Va8SNa8Xa85N:tg8Va8VNa8Xa83Na80a8SN:tg8Xa8XNMMg83:rh80a8Ya87Nh85a8Wa87Nh89aRa87Nh87a8WaBa8YNg8SNh8:a8SaRNhZaRaBa8WNgnNhca8Ya8SNh8Ya8WanNh8WaRaBaRNNh8Sdna83Jbbbb9ETmba81a80:vh81a8Xa80:vh8Xa8Va80:vh8VkaIaHaCcdtfydbc8S2fgOaOIdba8Sa8VaUa80:rNgRa8VNNMg80MUdbaOa8Wa8XaRa8XNg8SNMg83aOIdlMUdlaOa8Ya81aRa81Ng8WNMg8YaOIdwMUdwaOaca8Va8SNMg8SaOIdxMUdxaOaZa8Wa8VNMgUaOIdzMUdzaOa8:a8Xa8WNMg8WaOIdCMUdCaOa87a8VaRa81a86Na8Va8UNa8Za8XNMMg86:mNgRNMg8VaOIdKMUdKaOa89a8XaRNMg8XaOId3MUd3aOa85a81aRNMg81aOIdaMUdaaOa88a86aRN:tgRaOId8KMUd8KaOaBaOIdyMUdyaIaHaQcdtfydbc8S2fgOa80aOIdbMUdbaOa83aOIdlMUdlaOa8YaOIdwMUdwaOa8SaOIdxMUdxaOaUaOIdzMUdzaOa8WaOIdCMUdCaOa8VaOIdKMUdKaOa8XaOId3MUd3aOa81aOIdaMUdaaOaRaOId8KMUd8KaOaBaOIdyMUdykaeclfgecx9hmbkaLcxfhLa8Acifg8Aad6mbkkdnamcjeGTmbalTmbcbh9cindnaKa9cgecdtgOfydbghaKaecefg9ccdtfydbg8M9pmba8Kaecx2fhDaIaHaOfydbgCc8S2fh8AindnaHaEahcitfgeydbgLcdtfydbg8JaC0mbaeydlh8LcuhAaLheindnaKaecdtgYfgeclfydbgOaeydbgeSmbaOae9RhOaEaecitfheindnaHaeydbcdtfydbaC9hmbaAcu9hhQaLhAaQmbaeclfydbhAkaecwfheaOcufgOmbkkaXaYfydbgeaL9hmbkaAaLSmbaAcuSmba8KaLcx2fgeIdbaDIdbg81:tgRa8Ka8Lcx2fgOIdlaDIdlg80:tg8XNaeIdla80:tg8VaOIdba81:tg8YN:tg86a8KaAcx2fgAIdba81:tg8Za8VNaAIdla80:tg83aRN:tg8SNa8VaOIdwaDIdwgB:tg8UNaeIdwaB:tg8Wa8XN:tg85a83a8WNaAIdwaB:tg87a8VN:tgUNa8Wa8YNaRa8UN:tg88a87aRNa8Za8WN:tg89NMMa86a86Na85a85Na88a88NMM:rJ:A:z9z:;Na8Sa8SNaUaUNa89a89NMM:rN9Gmbdna8Ua8Wa8WNaRaRNa8Va8VNMMg8SNa8Wa8Ua8WNa8YaRNa8Va8XNMMg86N:tg8Ua8UNa8Ya8SNaRa86N:tg8Ya8YNa8Xa8SNa8Va86N:tg86a86NMMg8XJbbbb9ETmba8Ua8X:rg8X:vh8Ua86a8X:vh86a8Ya8X:vh8Yka8S:rg8Xa8UaBNa8Ya81Na80a86NMM:mgUNg85aUNhUa8Ua85Nh88a86a85Nh89a8Ya85Nh8:a86a8Xa8UNg85NhZa85a8YNhna8Ya8Xa86NgcNhJa8Ua85Nh8Ua86acNh86a8Ya8Xa8YNNh85dna87a8SNa8Wa87a8WNa8ZaRNa8Va83NMMg8YN:tg8Wa8WNa8Za8SNaRa8YN:tgRaRNa83a8SNa8Va8YN:tg8Va8VNMMg8YJbbbb9ETmba8Wa8Y:rg8Y:vh8Wa8Va8Y:vh8VaRa8Y:vhRka8Aa8AIdba85aRa8XaRNNMg8SMUdba8Aa86a8Va8Xa8VNg8ZNMg86a8AIdlMUdla8Aa8Ua8Wa8Xa8WNg8YNMg8Ua8AIdwMUdwa8AaJaRa8ZNMg8Za8AIdxMUdxa8Aana8YaRNMg83a8AIdzMUdza8AaZa8Va8YNMg85a8AIdCMUdCa8Aa8:aRa8Xa8WaBNaRa81Na80a8VNMMg81:mNg8YNMgRa8AIdKMUdKa8Aa89a8Va8YNMg8Va8AId3MUd3a8Aa88a8Wa8YNMg8Wa8AIdaMUdaa8AaUa81a8YN:tg8Ya8AId8KMUd8Ka8Aa8Xa8XMg8Xa8AIdyMUdyaIa8Jc8S2fgea8SaeIdbMUdbaea86aeIdlMUdlaea8UaeIdwMUdwaea8ZaeIdxMUdxaea83aeIdzMUdzaea85aeIdCMUdCaeaRaeIdKMUdKaea8VaeId3MUd3aea8WaeIdaMUdaaea8YaeId8KMUd8Kaea8XaeIdyMUdykahcefgha8M9hmbkka9cal9hmbkkdnadTmbaaTmbcbhYinJbbbbh80a8KabaYcdtfgeclfydbgLcx2fgOIdwa8Kaeydbghcx2fgAIdwg8Z:tg8Va8VNaOIdbaAIdbg83:tg8Wa8WNaOIdlaAIdlg85:tg8Xa8XNMMg8Sa8Kaecwfydbg8Acx2fgeIdwa8Z:tg8YNa8Va8YNa8WaeIdba83:tg81Na8XaeIdla85:tgBNMMgRa8VN:tJbbbbJbbjZa8Sa8Ya8YNa81a81NaBaBNMMg8UNaRaRN:tg86:va86Jbbbb9BEg86Nh88a8Ua8VNaRa8YN:ta86Nh89a8SaBNaRa8XN:ta86Nh8:a8Ua8XNaRaBN:ta86NhZa8Sa81NaRa8WN:ta86Nhna8Ua8WNaRa81N:ta86Nhca8WaBNa8Xa81N:tgRaRNa8Xa8YNa8VaBN:tgRaRNa8Va81Na8Wa8YN:tgRaRNMM:rJbbbZNhRa8Pahaa2g8JcdtfhOa8Pa8Aaa2g8McdtfhAa8PaLaa2gDcdtfhCa8Z:mhJa85:mh9ea83:mhTascjdfheaahQJbbbbhBJbbbbh86Jbbbbh8SJbbbbh8UJbbbbh8ZJbbbbh83Jbbbbh85Jbbbbh87JbbbbhUinaecwfaRa89aCIdbaOIdbg8Y:tg8XNa88aAIdba8Y:tg81NMg8VNUdbaeclfaRaZa8XNa8:a81NMg8WNUdbaeaRaca8XNana81NMg8XNUdbaecxfaRaJa8VNa9ea8WNa8YaTa8XNMMMg8YNUdbaRa8Va8WNNa8ZMh8ZaRa8Va8XNNa8UMh8UaRa8Wa8XNNa8SMh8SaRa8Ya8YNNaUMhUaRa8Va8YNNa87Mh87aRa8Wa8YNNa85Mh85aRa8Xa8YNNa83Mh83aRa8Va8VNNa86Mh86aRa8Wa8WNNaBMhBaRa8Xa8XNNa80Mh80aOclfhOaCclfhCaAclfhAaeczfheaQcufgQmbkagahc8S2fgea80aeIdbMUdbaeaBaeIdlMUdlaea86aeIdwMUdwaea8SaeIdxMUdxaea8UaeIdzMUdzaea8ZaeIdCMUdCaea83aeIdKMUdKaea85aeId3MUd3aea87aeIdaMUdaaeaUaeId8KMUd8KaeaRaeIdyMUdyagaLc8S2fgea80aeIdbMUdbaeaBaeIdlMUdlaea86aeIdwMUdwaea8SaeIdxMUdxaea8UaeIdzMUdzaea8ZaeIdCMUdCaea83aeIdKMUdKaea85aeId3MUd3aea87aeIdaMUdaaeaUaeId8KMUd8KaeaRaeIdyMUdyaga8Ac8S2fgea80aeIdbMUdbaeaBaeIdlMUdlaea86aeIdwMUdwaea8SaeIdxMUdxaea8UaeIdzMUdzaea8ZaeIdCMUdCaea83aeIdKMUdKaea85aeId3MUd3aea87aeIdaMUdaaeaUaeId8KMUd8KaeaRaeIdyMUdya8Ra8JcltfhLcbhOaahCinaLaOfgeascjdfaOfgAIdbaeIdbMUdbaeclfgQaAclfIdbaQIdbMUdbaecwfgQaAcwfIdbaQIdbMUdbaecxfgeaAcxfIdbaeIdbMUdbaOczfhOaCcufgCmbka8RaDcltfhLcbhOaahCinaLaOfgeascjdfaOfgAIdbaeIdbMUdbaeclfgQaAclfIdbaQIdbMUdbaecwfgQaAcwfIdbaQIdbMUdbaecxfgeaAcxfIdbaeIdbMUdbaOczfhOaCcufgCmbka8Ra8McltfhLcbhOaahCinaLaOfgeascjdfaOfgAIdbaeIdbMUdbaeclfgQaAclfIdbaQIdbMUdbaecwfgQaAcwfIdbaQIdbMUdbaecxfgeaAcxfIdbaeIdbMUdbaOczfhOaCcufgCmbkaYcifgYad6mbkkcbhAdndnamcwGgSmbJbbbbh86cbh9hcbh9icbh6xekcbh9ha3cbyd;y:L:cjbHjjjjbbh6asc:Cefasyd;8egecdtfa6BdbasaecefBd;8ecua6alabadaHz:fjjjbgCcltaCcjjjjiGEcbyd;y:L:cjbHjjjjbbh9iasc:Cefasyd;8egecdtfa9iBdbasaecefBd;8ea9iaCa6a8Kalz:gjjjbJFFuuh86aCTmba9iheaChOinaeIdbgRa86a86aR9EEh86aeclfheaOcufgOmbkaCh9hkdnalTmbaKclfheaKydbhCa5hOalhQcbhAincbaeydbgLaC9RaORbbcpeGEaAfhAaOcefhOaeclfheaLhCaQcufgQmbkaAce4hAkcuadaA9Rcifg9kcx2a9kc;v:Q;v:Qe0Ecbyd;y:L:cjbHjjjjbbh0asc:Cefasyd;8egecdtfa0BdbasaecefBd;8ecua9kcdta9kcFFFFi0Ecbyd;y:L:cjbHjjjjbbh9masc:Cefasyd;8egecdtfa9mBdbasaecefBd;8ea3cbyd;y:L:cjbHjjjjbbh9nasc:Cefasyd;8egecdtfa9nBdbasaecefBd;8ealcbyd;y:L:cjbHjjjjbbh9oasc:Cefasyd;8egecdtfa9oBdbasaecefBd;8eaxaxNayJbbjZamclGEg9pa9pN:vh87JbbbbhUdnadak9nmbdna9kci6mbamcjdGh9qaaclth9ra0cwfh9sJbbbbh85JbbbbhUinascNefabadalaHz:cjjjbabh8Acbh3cbh9tinaba9tcdtfh8McbheindnaHa8AaefydbgAcdtghfydbgCaHa8Maec:W:G:cjbfydbcdtfydbgOcdtg8JfydbgQSmba5aOfRbbgYco2a5aAfRbbgLfRb;a:G:cjbg8LaLco2aYfgDRb;a:G:cjbg9cVcFeGTmbdnaQaC9nmbaDRb;W:G:cjbcFeGmekdnaLcufcFeGce0mbaYTmba8EahfydbaO9hmekdnaLTmbaYcufcFeGce0mba8Fa8JfydbaA9hmeka0a3cx2fgCaOaAa9ccFeGgQEBdlaCaAaOaQEBdbaCaQa8LGcb9hBdwa3cefh3kaeclfgecx9hmbkdna9tcifg9tad9pmba8Acxfh8Aa3cifa9k9nmekka3TmdcbhDinaIaHa0aDcx2fghydbgLcdtgCfydbg8Jc8S2fgeIdwa8KahydlgYcx2fgOIdwg8WNaeIdzaOIdbg8XNaeIdaMgRaRMMa8WNaeIdlaOIdlg8YNaeIdCa8WNaeId3MgRaRMMa8YNaeIdba8XNaeIdxa8YNaeIdKMgRaRMMa8XNaeId8KMMM:lhRJbbbbJbbjZaeIdyg8V:va8VJbbbb9BEh8Vdndnahydwg8MmbJFFuuhBxekJbbbbJbbjZaIaHaYcdtfydbc8S2fgeIdyg81:va81Jbbbb9BEaeIdwa8KaLcx2fgOIdwg81NaeIdzaOIdbg80NaeIdaMgBaBMMa81NaeIdlaOIdlgBNaeIdCa81NaeId3Mg81a81MMaBNaeIdba80NaeIdxaBNaeIdKMg81a81MMa80NaeId8KMMM:lNhBka8VaRNh80dnaaTmbagaLc8S2fgAIdwa8WNaAIdza8XNaAIdaMgRaRMMa8WNaAIdla8YNaAIdCa8WNaAId3MgRaRMMa8YNaAIdba8XNaAIdxa8YNaAIdKMgRaRMMa8XNaAId8KMMMhRa8PaYaa2gQcdtfhOa8RaLaa2g8AcltfheaAIdyh81aahAinaOIdbg8Va8Va81NaecxfIdba8WaecwfIdbNa8XaeIdbNa8YaeclfIdbNMMMg8Va8VM:tNaRMhRaOclfhOaeczfheaAcufgAmbkaR:lgRa81aRa819DEaRa9qEh8Sdndna8MmbJbbbbhRxekagaYc8S2fgAIdwa8KaLcx2fgeIdwg8WNaAIdzaeIdbg8XNaAIdaMgRaRMMa8WNaAIdlaeIdlg8YNaAIdCa8WNaAId3MgRaRMMa8YNaAIdba8XNaAIdxa8YNaAIdKMgRaRMMa8XNaAId8KMMMhRa8Pa8AcdtfhOa8RaQcltfheaAIdyh81aahAinaOIdbg8Va8Va81NaecxfIdba8WaecwfIdbNa8XaeIdbNa8YaeclfIdbNMMMg8Va8VM:tNaRMhRaOclfhOaeczfheaAcufgAmbkaR:lgRa81aRa819DEaRa9qEhRka80a8SMh80aBaRMhBdndndna5aLfRbbc9:fPibeedkdna8Fa8Ea8EaCfydbaYSEaXaCfydbgQcdtfydbgCcu9hmbaXaYcdtfydbhCkagaQc8S2fgAIdwa8KaCcx2fgeIdwg8WNaAIdzaeIdbg8XNaAIdaMgRaRMMa8WNaAIdlaeIdlg8YNaAIdCa8WNaAId3MgRaRMMa8YNaAIdba8XNaAIdxa8YNaAIdKMgRaRMMa8XNaAId8KMMMhRa8PaCaa2g8AcdtfhOa8RaQaa2g8JcltfheaAIdyh81aahAinaOIdbg8Va8Va81NaecxfIdba8WaecwfIdbNa8XaeIdbNa8YaeclfIdbNMMMg8Va8VM:tNaRMhRaOclfhOaeczfheaAcufgAmbkaR:lgRa81aRa819DEaRa9qEh8Sdndna8MmbJbbbbhRxekagaCc8S2fgAIdwa8KaQcx2fgeIdwg8WNaAIdzaeIdbg8XNaAIdaMgRaRMMa8WNaAIdlaeIdlg8YNaAIdCa8WNaAId3MgRaRMMa8YNaAIdba8XNaAIdxa8YNaAIdKMgRaRMMa8XNaAId8KMMMhRa8Pa8JcdtfhOa8Ra8AcltfheaAIdyh81aahAinaOIdbg8Va8Va81NaecxfIdba8WaecwfIdbNa8XaeIdbNa8YaeclfIdbNMMMg8Va8VM:tNaRMhRaOclfhOaeczfheaAcufgAmbkaR:lgRa81aRa819DEaRa9qEhRka80a8SMh80aBaRMhBxdkaXaCfydbgCaLSmbaHaYcdtfydbh8Aindndna8EaCcdtgQfydbgecuSmbaHaecdtfydba8ASmekdna8FaQfydbgecuSmbaHaecdtfydba8ASmekaYhekagaCc8S2fgAIdwa8Kaecx2fgOIdwg8WNaAIdzaOIdbg8XNaAIdaMgRaRMMa8WNaAIdlaOIdlg8YNaAIdCa8WNaAId3MgRaRMMa8YNaAIdba8XNaAIdxa8YNaAIdKMgRaRMMa8XNaAId8KMMMhRa8Paeaa2cdtfhOa8RaCaa2cltfheaAIdyh81aahAinaOIdbg8Va8Va81NaecxfIdba8WaecwfIdbNa8XaeIdbNa8YaeclfIdbNMMMg8Va8VM:tNaRMhRaOclfhOaeczfheaAcufgAmbka80aR:lgRa81aRa819DEaRa9qEMh80aXaQfydbgCaL9hmbkkdna5aYfRbbgeciSmbaecl9hmeka8MTmbaXaYcdtfydbgCaYSmbindndna8EaCcdtgQfydbgecuSmbaHaecdtfydba8JSmekdna8FaQfydbgecuSmbaHaecdtfydba8JSmekaLhekagaCc8S2fgAIdwa8Kaecx2fgOIdwg8WNaAIdzaOIdbg8XNaAIdaMgRaRMMa8WNaAIdlaOIdlg8YNaAIdCa8WNaAId3MgRaRMMa8YNaAIdba8XNaAIdxa8YNaAIdKMgRaRMMa8XNaAId8KMMMhRa8Paeaa2cdtfhOa8RaCaa2cltfheaAIdyh81aahAinaOIdbg8Va8Va81NaecxfIdba8WaecwfIdbNa8XaeIdbNa8YaeclfIdbNMMMg8Va8VM:tNaRMhRaOclfhOaeczfheaAcufgAmbkaBaR:lgRa81aRa819DEaRa9qEMhBaXaQfydbgCaY9hmbkkahaBa80aBa809DgeEUdwahaLaYaea8Mcb9hGgeEBdlahaYaLaeEBdbaDcefgDa39hmbkascjdfcbcj;qbz:xjjjb8Aa9shea3hOinascjdfaeydbcA4cF8FGgAcFAaAcFA6EcdtfgAaAydbcefBdbaecxfheaOcufgOmbkcbhecbhOinascjdfaefgAydbhCaAaOBdbaCaOfhOaeclfgecj;qb9hmbkcbhea9shOinascjdfaOydbcA4cF8FGgAcFAaAcFA6EcdtfgAaAydbgAcefBdba9maAcdtfaeBdbaOcxfhOa3aecefge9hmbkadak9RgAci9Uh9udnalTmbcbhea9nhOinaOaeBdbaOclfhOalaecefge9hmbkkcbh9va9ocbalz:xjjjbh9caAcO9Uh9wa9uce4h9tcbh8Lcbh8Mdnina0a9ma8Mcdtfydbcx2fg8JIdwgRa879Emea8La9u9pmeJFFuuh8Vdna9ta39pmba0a9ma9tcdtfydbcx2fIdwJbb;aZNh8VkdnaRa8V9ETmbaRaU9ETmba8La9w0mdkdna9caHa8JydlgDcdtg9xfg8AydbgAfg9yRbba9caHa8Jydbghcdtg9zfydbgefg9ARbbVmba5ahfRbbh9BdndnaKaecdtfgOclfydbgCaOydbgOSmbaCaO9RhCa8KaAcx2fhLa8Kaecx2fhYaEaOcitfheindna9naeydbcdtfydbgOaASmba9naeclfydbcdtfydbgQaASmbaOaQSmba8KaQcx2fgQIdba8KaOcx2fgOIdbg8W:tgRaYIdlaOIdlg8X:tg80NaQIdla8X:tg8VaYIdba8W:tgBN:tg8YaRaLIdla8X:tg8SNa8VaLIdba8W:tg8UN:tg8XNa8VaYIdwaOIdwg81:tg8ZNaQIdwa81:tg8Wa80N:tg80a8VaLIdwa81:tg83Na8Wa8SN:tg8VNa8WaBNaRa8ZN:tg81a8Wa8UNaRa83N:tgRNMMa8Ya8YNa80a80Na81a81NMMa8Xa8XNa8Va8VNaRaRNMMN:rJbbj8:N9FmikaecwfheaCcufgCmbkkdndna9Bc99fcFeGce0mba9na9zfaDBdbaXa9zfydbgeahSmeina8AydbhAdndna8EaecdtgOfydbgecuSmbaHaecdtfydbaASmekdna8FaOfydbgecuSmbaHaecdtfydbaASmekaDheka9naOfaeBdbaXaOfydbgeah9hmbxdkkdndna9BcFeGcdSmbaDhexekdna8Fa8Ea8Ea9zfydbaDSEaXa9zfydbghcdtfydbgecu9hmbaXa9xfydbheka9na9zfaDBdbka9nahcdtfaeBdbka9Ace86bba9yce86bba8JIdwgRaUaUaR9DEhUa9vcefh9vcecda9BcFeGceSEa8Lfh8Lxeka9tcefh9tka8Mcefg8Ma39hmbkka9vTmddnalTmbcbhLcbhhindna9nahcdtgefydbgAahSmbaHaAcdtfydbh8AdnahaHaefydb9hg8JmbaIa8Ac8S2fgeaIahc8S2fgOIdbaeIdbMUdbaeaOIdlaeIdlMUdlaeaOIdwaeIdwMUdwaeaOIdxaeIdxMUdxaeaOIdzaeIdzMUdzaeaOIdCaeIdCMUdCaeaOIdKaeIdKMUdKaeaOId3aeId3MUd3aeaOIdaaeIdaMUdaaeaOId8KaeId8KMUd8KaeaOIdyaeIdyMUdya8NTmba8Na8Acltfgea8NahcltfgOIdbaeIdbMUdbaeaOIdlaeIdlMUdlaeaOIdwaeIdwMUdwaeaOIdxaeIdxMUdxkaaTmbagaAc8S2fgeagahc8S2g8MfgOIdbaeIdbMUdbaeaOIdlaeIdlMUdlaeaOIdwaeIdwMUdwaeaOIdxaeIdxMUdxaeaOIdzaeIdzMUdzaeaOIdCaeIdCMUdCaeaOIdKaeIdKMUdKaeaOId3aeId3MUd3aeaOIdaaeIdaMUdaaeaOId8KaeId8KMUd8KaeaOIdyaeIdyMUdya9raA2hYa8RhOaahCinaOaYfgeaOaLfgAIdbaeIdbMUdbaeclfgQaAclfIdbaQIdbMUdbaecwfgQaAcwfIdbaQIdbMUdbaecxfgeaAcxfIdbaeIdbMUdbaOczfhOaCcufgCmbka8JmbJbbbbJbbjZaIa8MfgeIdygR:vaRJbbbb9BEaeIdwa8Ka8Acx2fgOIdwgRNaeIdzaOIdbg8VNaeIdaMg8Wa8WMMaRNaeIdlaOIdlg8WNaeIdCaRNaeId3MgRaRMMa8WNaeIdba8VNaeIdxa8WNaeIdKMgRaRMMa8VNaeId8KMMM:lNgRa85a85aR9DEh85kaLa9rfhLahcefghal9hmbkcbhOa8EheindnaeydbgAcuSmbdnaOa9naAcdtgCfydbgA9hmbcuhAa8EaCfydbgCcuSmba9naCcdtfydbhAkaeaABdbkaeclfhealaOcefgO9hmbkcbhOa8FheindnaeydbgAcuSmbdnaOa9naAcdtgCfydbgA9hmbcuhAa8FaCfydbgCcuSmba9naCcdtfydbhAkaeaABdbkaeclfhealaOcefgO9hmbkka85aUaaEh85cbhOabhecbhAindnaHa9naeydbcdtfydbgLcdtfydbgCaHa9naeclfydbcdtfydbgYcdtfydbgQSmbaCaHa9naecwfydbcdtfydbg8AcdtfydbghSmbaQahSmbabaOcdtfgCaLBdbaCcwfa8ABdbaCclfaYBdbaOcifhOkaecxfheaAcifgAad6mbkdndnaSmbaOhdxekdnaOak0mbaOhdxekdna86a859FmbaOhdxekJFFuuh86cbhdabhecbhAindna9ia6aeydbgCcdtfydbcdtfIdbgRa859ETmbaeclf8Pdbh9CabadcdtfgQaCBdbaQclfa9C83dbaRa86a86aR9EEh86adcifhdkaecxfheaAcifgAaO6mbkkadak0mbxdkkascNefabadalaHz:cjjjbkdndnadak0mbadhYxekdnaSmbadhYxekdna86a879FmbadhYxekcehQina86Jbb;aZNgRa87aRa879DEh8WJbbbbhRdna9hTmba9ihea9hhOinaeIdbg8VaRa8Va8W9FEaRa8VaR9EEhRaeclfheaOcufgOmbkkJFFuuh86cbhYabhecbhOindna9ia6aeydbgAcdtfydbcdtfIdbg8Va8W9ETmbaeclf8Pdbh9CabaYcdtfgCaABdbaCclfa9C83dba8Va86a86a8V9EEh86aYcifhYkaecxfheaOcifgOad6mbkdnaQaYad9hVceGmbadhYxdkaRaUaUaR9DEhUaYak9nmecbhQaYhda86a879FmbkkdnamcjjjjdGTmba9ocbalz:xjjjbh8AdnaYTmbabheaYhOina8AaeydbgAfce86bba8AaHaAcdtfydbfce86bbaeclfheaOcufgOmbkkascNefabaYalaHz:cjjjbdndnalTmbcbhCindna8AaCfRbbTmbdna5aCfRbbPlbeebekdnaHaCcdtgLfydbgeaCSmba8KaCcx2fgOa8Kaecx2fgeydwBdwaOae8Pdb83dbxekaIaCc8S2fgQIdygnanJL:3;rUNgRMh87aQIdwgxaRMh8SaQIdlg9DaRMh8UaQIdbg9EaRMh81aQIdag9FaRa8KaCcx2fg8JIdwg88N:th8ZaQId3g9GaRa8JIdlg89N:th83aQIdKg9Ha8JIdbg8:aRN:th80JbbbbhZaQIdCg9IJbbbbMh85aQIdzg9JJbbbbMhBaQIdxg9KJbbbbMh86dndnaaTmbaChAinJbbbba87agaAc8S2fgOIdygR:vaRJbbbb9BEhRa8RaAaa2cltfheaOIdaa87Na8ZMh8ZaOId3a87Na83Mh83aOIdKa87Na80Mh80aOIdCa87Na85Mh85aOIdza87NaBMhBaOIdxa87Na86Mh86aOIdwa87Na8SMh8SaOIdla87Na8UMh8UaOIdba87Na81Mh81aahOina8ZaecwfIdbg8VaecxfIdbg8YNaRN:th8Za83aeclfIdbg8Wa8YNaRN:th83a85a8Wa8VNaRN:th85a81aeIdbg8Xa8XNaRN:th81a80a8Xa8YNaRN:th80aBa8Xa8VNaRN:thBa86a8Xa8WNaRN:th86a8Sa8Va8VNaRN:th8Sa8Ua8Wa8WNaRN:th8UaeczfheaOcufgOmbkaXaAcdtfydbgAaC9hmbka8NTmba8NaCcltfgeIdxhTaeIdwhcaeIdlhJaeIdbhRxekJbbbbhTJbbbbhcJbbbbhJJbbbbhRkaBa81:vg8Wa80Na8Z:ta85aBa86a81:vg8VN:tg8Za8Ua86a8VN:tg8Y:vg8Xa8Va80Na83:tg8UN:th83acaRa8WN:taJaRa8VN:tg86a8XN:tg85a8SaBa8WN:ta8Za8XN:tgB:vg8S:mh8Za86a8Y:vgc:mhJdnJbbbbaRaRa81:vg9eN:ta86acN:ta85a8SN:tg86:la87J:983:g81NgR9ETmba8Za83NaJa8UNa9ea80NaT:tMMa86:vhZka81:laR9ETmba8Y:laR9ETmbaB:laR9ETmba9e:maZNa8W:ma8ZaZNa83aB:vMgBNa8V:maJaZNa8X:maBNa8Ua8Y:vMMg85Na80:ma81:vMMMh87aKaLfgeclfydbgOaeydbge9RhhaEaecitfhLJbbbbhRdnaOaeSg8MmbJbbbbhRaLheahhAina8Kaeclfydbcx2fgOIdwa88:tg8Va8VNaOIdba8::tg8Va8VNaOIdla89:tg8Va8VNMMg8Va8Kaeydbcx2fgOIdwa88:tg8Wa8WNaOIdba8::tg8Wa8WNaOIdla89:tg8Wa8WNMMg8WaRaRa8W9DEgRaRa8V9DEhRaecwfheaAcufgAmbkaR:rgRaRNhRkaBa88:tg8Va8VNa87a8::tg8Va8VNa85a89:tg8Va8VNMMaR9EmbaQId8KhZdna8Mmbina8KaLclfydbcx2fgeIdba8KaLydbcx2fgOIdbg8W:tgRa89aOIdlg8X:tg80NaeIdla8X:tg8Va8:a8W:tg86N:tg8YaRa85a8X:tg8SNa8Va87a8W:tg8UN:tg8XNa8Va88aOIdwg81:tg8ZNaeIdwa81:tg8Wa80N:tg80a8VaBa81:tg83Na8Wa8SN:tg8VNa8Wa86NaRa8ZN:tg81a8Wa8UNaRa83N:tgRNMMa8Ya8YNa80a80Na81a81NMMa8Xa8XNa8Va8VNaRaRNMMN:rJbbj8:N9FmdaLcwfhLahcufghmbkkJbbbbJbbjZan:vanJbbbb9BEgRaxaBNa9Ja87Na9FMg8Va8VMMaBNa9Da85Na9IaBNa9GMg8Va8VMMa85Na9Ea87Na9Ka85Na9HMg8Va8VMMa87NaZMMM:lNaRaxa88Na9Ja8:Na9FMg8Va8VMMa88Na9Da89Na9Ia88Na9GMg8Va8VMMa89Na9Ea8:Na9Ka89Na9HMg8Va8VMMa8:NaZMMM:lNJbb;aZNJ:983:g81M9Emba8JaBUdwa8Ja85Udla8Ja87UdbkaCcefgCal9hmbkdnaambcbhaxdkcbhQindna8AaQfRbbTmbaHaQcdtgefydbaQ9hmba5aQfhhaXaefh8Ja8KaQcx2fhAa8PaQaa2cdtfh8McbhEincuhCdnahRbbc99fcFeGce0mbaQhCa8JydbgeaQSmba8PaEcdtgOfhLa8MaOfIdbhRaQhCinaChOcuhCdnaLaeaa2cdtfIdbaR9CmbaOcuSmbaOhCagaec8S2fIdyagaOc8S2fIdy9ETmbaehCkaXaecdtfydbgeaQ9hmbkka8PaEcdtfhLa8RaEcltfhKaQheinaLaeaa2cdtfJbbbbJbbjZagaeaCaCcuSEgOc8S2fIdygR:vaRJbbbb9BEaKaOaa2cltfgOIdwaAIdwNaOIdbaAIdbNaOIdlaAIdlNMMaOIdxMNUdbaXaecdtfydbgeaQ9hmbkaEcefgEaa9hmbkkaQcefgQal9hmbxdkkaambcbhakaiavaoarawaaala8Ka8Pazasayasc1efa5a8Aaqz:hjjjbkdnamcjjjjlGTmbazmbaYTmbabhecbhLina5aeydbgAfRbbc3thQaecwfgXydbhHcjjjj94hCdna8EaAcdtgEfydbaeclfgKydbgOSmbcjjjj94cba8FaOcdtfydbaASEhCkaeaQaCVaAVBdba5aOfRbbc3thacjjjj94hCcjjjj94hQdna8EaOcdtfydbaHSmbcjjjj94cba8FaHcdtfydbaOSEhQkaKaaaQVaOVBdba5aHfRbbc3thOdna8EaHcdtfydbaASmbcjjjj94cba8FaEfydbaHSEhCkaXaOaCVaHVBdbaecxfheaLcifgLaY6mbkkdnazTmbaYTmbaYheinabazabydbcdtfydbBdbabclfhbaecufgembkkdnaPTmbaPa9paU:rNUdbkdnasyd;8egHTmbaHcdtasc:Ceffc98fheinaeydbcbyd;C:L:cjbH:bjjjbbaec98fheaHcufgHmbkkascj;sbf8KjjjjbaYk;Yieouabydlhvabydbclfcbaicdtz:xjjjbhoadci9UhrdnadTmbdnalTmbaehwadhDinaoalawydbcdtfydbcdtfgqaqydbcefBdbawclfhwaDcufgDmbxdkkaehwadhDinaoawydbcdtfgqaqydbcefBdbawclfhwaDcufgDmbkkdnaiTmbcbhDaohwinawydbhqawaDBdbawclfhwaqaDfhDaicufgimbkkdnadci6mbinaecwfydbhwaeclfydbhDaeydbhidnalTmbalawcdtfydbhwalaDcdtfydbhDalaicdtfydbhikavaoaicdtfgqydbcitfaDBdbavaqydbcitfawBdlaqaqydbcefBdbavaoaDcdtfgqydbcitfawBdbavaqydbcitfaiBdlaqaqydbcefBdbavaoawcdtfgwydbcitfaiBdbavawydbcitfaDBdlawawydbcefBdbaecxfhearcufgrmbkkabydbcbBdbk:todDue99aicd4aifhrcehwinawgDcethwaDar6mbkcuaDcdtgraDcFFFFi0Ecbyd;y:L:cjbHjjjjbbhwaoaoyd9GgqcefBd9GaoaqcdtfawBdbawcFearz:xjjjbhkdnaiTmbalcd4hlaDcufhxcbhminamhDdnavTmbavamcdtfydbhDkcbadaDal2cdtfgDydlgwawcjjjj94SEgwcH4aw7c:F:b:DD2cbaDydbgwawcjjjj94SEgwcH4aw7c;D;O:B8J27cbaDydwgDaDcjjjj94SEgDcH4aD7c:3F;N8N27axGhwamcdthPdndndnavTmbakawcdtfgrydbgDcuSmeadavaPfydbal2cdtfgsIdbhzcehqinaqhrdnadavaDcdtfydbal2cdtfgqIdbaz9CmbaqIdlasIdl9CmbaqIdwasIdw9BmlkarcefhqakawarfaxGgwcdtfgrydbgDcu9hmbxdkkakawcdtfgrydbgDcuSmbadamal2cdtfgsIdbhzcehqinaqhrdnadaDal2cdtfgqIdbaz9CmbaqIdlasIdl9CmbaqIdwasIdw9BmikarcefhqakawarfaxGgwcdtfgrydbgDcu9hmbkkaramBdbamhDkabaPfaDBdbamcefgmai9hmbkkakcbyd;C:L:cjbH:bjjjbbaoaoyd9GcufBd9GdnaeTmbaiTmbcbhDaehwinawaDBdbawclfhwaiaDcefgD9hmbkcbhDaehwindnaDabydbgrSmbawaearcdtfgrydbBdbaraDBdbkabclfhbawclfhwaiaDcefgD9hmbkkk;:odvuv998Jjjjjbca9Rgocbyd1:G:cjbBdKaocb8Pdj:G:cjb83izaocbydN:G:cjbBdwaocb8Pd:m:G:cjb83ibdnadTmbaicd4hrdnabmbdnalTmbcbhwinaealawcdtfydbar2cdtfhDcbhiinaoczfaifgqaDaifIdbgkaqIdbgxaxak9EEUdbaoaifgqakaqIdbgxaxak9DEUdbaiclfgicx9hmbkawcefgwad9hmbxikkarcdthwcbhDincbhiinaoczfaifgqaeaifIdbgkaqIdbgxaxak9EEUdbaoaifgqakaqIdbgxaxak9DEUdbaiclfgicx9hmbkaeawfheaDcefgDad9hmbxdkkdnalTmbcbhwinabawcx2fgiaealawcdtfydbar2cdtfgDIdbUdbaiaDIdlUdlaiaDIdwUdwcbhiinaoczfaifgqaDaifIdbgkaqIdbgxaxak9EEUdbaoaifgqakaqIdbgxaxak9DEUdbaiclfgicx9hmbkawcefgwad9hmbxdkkarcdthlcbhwaehDinabawcx2fgiaeawar2cdtfgqIdbUdbaiaqIdlUdlaiaqIdwUdwcbhiinaoczfaifgqaDaifIdbgkaqIdbgxaxak9EEUdbaoaifgqakaqIdbgxaxak9DEUdbaiclfgicx9hmbkaDalfhDawcefgwad9hmbkkJbbbbaoIdbaoIdzgx:tgkakJbbbb9DEgkaoIdlaoIdCgm:tgPaPak9DEgkaoIdwaoIdKgP:tgsasak9DEhsdnabTmbadTmbJbbbbJbbjZas:vasJbbbb9BEhkinabakabIdbax:tNUdbabclfgoakaoIdbam:tNUdbabcwfgoakaoIdbaP:tNUdbabcxfhbadcufgdmbkkdnavTmbavaPUdwavamUdlavaxUdbkask:WlewudnaeTmbcbhvabhoinaoavBdbaoclfhoaeavcefgv9hmbkkdnaiTmbcbhrinadarcdtfhwcbhDinalawaDcdtgvyd:G:G:cjbcdtfydbcdtfydbhodnalawavfydbcdtfydbgqabaqcdtfgkydbgvSmbinakabavgqcdtfgxydbgvBdbaxhkaqav9hmbkkdnaoabaocdtfgkydbgvSmbinakabavgocdtfgxydbgvBdbaxhkaoav9hmbkkdnaqaoSmbabaqaoaqao0Ecdtfaqaoaqao6EBdbkaDcefgDci9hmbkarcifgrai6mbkkdnaembcbskcbhxindnalaxcdtgvfydbax9hmbaxhodnaxabavfgDydbgvSmbaDhqinaqabavgocdtfgkydbgvBdbakhqaoav9hmbkkaDaoBdbkaxcefgxae9hmbkcbhkabhvcbhoindndnaoalydbgq9hmbdnaoavydbgq9hmbavakBdbakcefhkxdkavabaqcdtfydbBdbxekavabaqcdtfydbBdbkalclfhlavclfhvaeaocefgo9hmbkakk;jiilud99euabcbaecltz:xjjjbhvdnalTmbadhoaihralhwinarcwfIdbhDarclfIdbhqavaoydbcltfgkarIdbakIdbMUdbakaqakIdlMUdlakaDakIdwMUdwakakIdxJbbjZMUdxaoclfhoarcxfhrawcufgwmbkkdnaeTmbavhkaehrinakcxfgoIdbhDaocbBdbakakIdbJbbbbJbbjZaD:vaDJbbbb9BEgDNUdbakclfgoaDaoIdbNUdbakcwfgoaDaoIdbNUdbakczfhkarcufgrmbkkdnalTmbinavadydbcltfgkaicwfIdbakIdw:tgDaDNaiIdbakIdb:tgDaDNaiclfIdbakIdl:tgDaDNMMgDakIdxgqaqaD9DEUdxadclfhdaicxfhialcufglmbkkdnaeTmbavcxfhkinabakIdbUdbakczfhkabclfhbaecufgembkkk:moerudnaoTmbaecd4hzdnavTmbaicd4hHavcdthOcbhAindnaPaAfRbbTmbaAhednaDTmbaDaAcdtfydbhekdnasTmbasaefRbbceGmekdnamaAfRbbcvSmbabaeaz2cdtfgiaraAcx2fgCIdbakNaxIdbMUdbaiaCIdlakNaxIdlMUdlaiaCIdwakNaxIdwMUdwkadaeaH2cdtfhXaqheawhiavhCinaXaeydbcdtgQfaiIdbalaQfIdb:vUdbaeclfheaiclfhiaCcufgCmbkkawaOfhwaAcefgAao9hmbxdkkdnasmbcbheaDhiindnaPaefRbbTmbaehCdnaDTmbaiydbhCkamaefRbbcvSmbabaCaz2cdtfgCarIdbakNaxIdbMUdbaCarclfIdbakNaxIdlMUdlaCarcwfIdbakNaxIdwMUdwkaiclfhiarcxfhraoaecefge9hmbxdkkdnaDTmbindnaPRbbTmbasaDydbgefRbbceGmbamRbbcvSmbabaeaz2cdtfgearIdbakNaxIdbMUdbaearclfIdbakNaxIdlMUdlaearcwfIdbakNaxIdwMUdwkaPcefhPaDclfhDamcefhmarcxfhraocufgombxdkkazcdthicbheindnaPaefRbbTmbasaefRbbceGmbamaefRbbcvSmbabarIdbakNaxIdbMUdbabclfarclfIdbakNaxIdlMUdbabcwfarcwfIdbakNaxIdwMUdbkarcxfhrabaifhbaoaecefge9hmbkkk8MbabaeadaialavcbcbcbcbcbaoarawaDz:bjjjbk8MbabaeadaialavaoarawaDaqakaxamaPz:bjjjbkRbababaeadaialavaoarawaDaqakaxcjjjjdVamz:bjjjbk:vgoque99due99duq998Jjjjjbc;Wb9Rgq8Kjjjjbcbhkaqcxfcbc;Kbz:xjjjb8Aaqcualcx2alc;v:Q;v:Qe0Ecbyd;y:L:cjbHjjjjbbgxBdxaqceBd2axaialavcbcbz:ejjjb8AaqcualcdtalcFFFFi0Egmcbyd;y:L:cjbHjjjjbbgiBdzaqcdBd2dndnJFF959eJbbjZawJbbjZawJbbjZ9DE:vawJ9VO:d869DEgw:lJbbb9p9DTmbaw:OhPxekcjjjj94hPkadci9Uhsarco9UhzdndnaombaPcd9imekdnalTmbaPcuf:YhwdnaoTmbcbhvaihHaxhOindndnaoavfRbbceGTmbavcjjjjlVhAxekdndnaOclfIdbawNJbbbZMgC:lJbbb9p9DTmbaC:OhAxekcjjjj94hAkaAcqthAdndnaOcwfIdbawNJbbbZMgC:lJbbb9p9DTmbaC:OhXxekcjjjj94hXkaAaXVhAdndnaOIdbawNJbbbZMgC:lJbbb9p9DTmbaC:OhXxekcjjjj94hXkaAaXcCtVhAkaHaABdbaHclfhHaOcxfhOalavcefgv9hmbxdkkaxhvaihOalhHindndnavIdbawNJbbbZMgC:lJbbb9p9DTmbaC:OhAxekcjjjj94hAkaAcCthAdndnavclfIdbawNJbbbZMgC:lJbbb9p9DTmbaC:OhXxekcjjjj94hXkaXcqtaAVhAdndnavcwfIdbawNJbbbZMgC:lJbbb9p9DTmbaC:OhXxekcjjjj94hXkaOaAaXVBdbavcxfhvaOclfhOaHcufgHmbkkadTmbcbhkaehvcbhOinakaiavclfydbcdtfydbgHaiavcwfydbcdtfydbgA9haiavydbcdtfydbgXaH9haXaA9hGGfhkavcxfhvaOcifgOad6mbkkarci9UhQdndnaz:Z:rJbbbZMgw:lJbbb9p9DTmbaw:Ohvxekcjjjj94hvkaQ:ZhLcbhKc:bwhzdninakaQ9pmeazaP9Rcd9imeavazcufgOavaO9iEaPcefavaP9kEhYdnalTmbaYcuf:YhwdnaoTmbcbhOaihHaxhvindndnaoaOfRbbceGTmbaOcjjjjlVhAxekdndnavclfIdbawNJbbbZMgC:lJbbb9p9DTmbaC:OhAxekcjjjj94hAkaAcqthAdndnavcwfIdbawNJbbbZMgC:lJbbb9p9DTmbaC:OhXxekcjjjj94hXkaAaXVhAdndnavIdbawNJbbbZMgC:lJbbb9p9DTmbaC:OhXxekcjjjj94hXkaAaXcCtVhAkaHaABdbaHclfhHavcxfhvalaOcefgO9hmbxdkkaxhvaihOalhHindndnavIdbawNJbbbZMgC:lJbbb9p9DTmbaC:OhAxekcjjjj94hAkaAcCthAdndnavclfIdbawNJbbbZMgC:lJbbb9p9DTmbaC:OhXxekcjjjj94hXkaXcqtaAVhAdndnavcwfIdbawNJbbbZMgC:lJbbb9p9DTmbaC:OhXxekcjjjj94hXkaOaAaXVBdbavcxfhvaOclfhOaHcufgHmbkkcbhOdnadTmbaehvcbhHinaOaiavclfydbcdtfydbgAaiavcwfydbcdtfydbgX9haiavydbcdtfydbgraA9haraX9hGGfhOavcxfhvaHcifgHad6mbkkdnas:ZgCaL:taY:Ygwaz:Y:tg8ANak:ZgEaO:Zg3:tNaEaL:tawaP:Y:tg5Na3aC:tNMg8EJbbbb9BmbaCaE:ta5a8Aa3aL:tNNNa8E:vawMhwkdndnaOaQ0mbaOhkaYhPxekaOhsaYhzkdndnaKcl0mbdnawJbbbZMgw:lJbbb9p9DTmbaw:Ohvxdkcjjjj94hvxekaPazfcd9ThvkaKcefgKcs9hmbkkdndndnakmbJbbjZhwcbhOcdhvaDmexdkalcd4alfhHcehOinaOgvcethOavaH6mbkaqcuavcdtavcFFFFi0Ecbyd;y:L:cjbHjjjjbbgYBdCaqciBd2aqamcbyd;y:L:cjbHjjjjbbgzBdKaqclBd2dnalTmbaPcuf:YhwdnaoTmbcbhOaihAaxhHindndnaoaOfRbbceGTmbaOcjjjjlVhXxekdndnaHclfIdbawNJbbbZMgC:lJbbb9p9DTmbaC:OhXxekcjjjj94hXkaXcqthXdndnaHcwfIdbawNJbbbZMgC:lJbbb9p9DTmbaC:Ohrxekcjjjj94hrkaXarVhXdndnaHIdbawNJbbbZMgC:lJbbb9p9DTmbaC:Ohrxekcjjjj94hrkaXarcCtVhXkaAaXBdbaAclfhAaHcxfhHalaOcefgO9hmbxdkkaxhOaihHalhAindndnaOIdbawNJbbbZMgC:lJbbb9p9DTmbaC:OhXxekcjjjj94hXkaXcCthXdndnaOclfIdbawNJbbbZMgC:lJbbb9p9DTmbaC:Ohrxekcjjjj94hrkarcqtaXVhXdndnaOcwfIdbawNJbbbZMgC:lJbbb9p9DTmbaC:Ohrxekcjjjj94hrkaHaXarVBdbaOcxfhOaHclfhHaAcufgAmbkkaqcuaYavazaialz:mjjjbgXc8S2gvaXc;D;O;f8U0Ecbyd;y:L:cjbHjjjjbbgiBd3aqcvBd2aicbavz:xjjjbhOdnadTmbcbhraehiinaxaiclfydbgocx2fgvIdbaxaiydbgPcx2fgHIdbg3:tgCaxaicwfydbgYcx2fgAIdlaHIdlg8A:tgwNavIdla8A:tgEaAIdba3:tg8EN:tgLaLNaEaAIdwaHIdwg5:tg8FNavIdwa5:tgEawN:tgwawNaEa8ENaCa8FN:tgCaCNMMg8E:rhEJbbnnJbbjZazaPcdtfydbgvazaocdtfydbgASavazaYcdtfydbgoSGgHEh8Fdna8EJbbbb9ETmbaLaE:vhLaCaE:vhCawaE:vhwkaOavc8S2fgvavIdbawa8FaE:rNgEawNNg8FMUdbavaCaEaCNgaNghavIdlMUdlavaLaEaLNg8ENggavIdwMUdwavawaaNgaavIdxMUdxava8EawNg8JavIdzMUdzavaCa8ENg8EavIdCMUdCavawaEaLa5Nawa3Na8AaCNMM:mg8ANg3NgwavIdKMUdKavaCa3NgCavId3MUd3avaLa3NgLavIdaMUdaava3a8ANg3avId8KMUd8KavaEavIdyMUdydnaHmbaOaAc8S2fgva8FavIdbMUdbavahavIdlMUdlavagavIdwMUdwavaaavIdxMUdxava8JavIdzMUdzava8EavIdCMUdCavawavIdKMUdKavaCavId3MUd3avaLavIdaMUdaava3avId8KMUd8KavaEavIdyMUdyaOaoc8S2fgva8FavIdbMUdbavahavIdlMUdlavagavIdwMUdwavaaavIdxMUdxava8JavIdzMUdzava8EavIdCMUdCavawavIdKMUdKavaCavId3MUd3avaLavIdaMUdaava3avId8KMUd8KavaEavIdyMUdykaicxfhiarcifgrad6mbkkcbhAaqcuaXcdtgvaXcFFFFi0Egicbyd;y:L:cjbHjjjjbbgHBdaaqcoBd2aqaicbyd;y:L:cjbHjjjjbbgiBd8KaqcrBd2aHcFeavz:xjjjbhPdnalTmbazhHinJbbbbJbbjZaOaHydbgrc8S2fgvIdygw:vawJbbbb9BEavIdwaxcwfIdbgwNavIdzaxIdbgCNavIdaMgLaLMMawNavIdlaxclfIdbgLNavIdCawNavId3MgwawMMaLNavIdbaCNavIdxaLNavIdKMgwawMMaCNavId8KMMM:lNhwdndnaParcdtgvfgrydbcuSmbaiavfIdbaw9ETmekaraABdbaiavfawUdbkaHclfhHaxcxfhxalaAcefgA9hmbkkdndnaXmbJbbbbhwxekJbbbbhwinaiIdbgCawawaC9DEhwaiclfhiaXcufgXmbkaw:rhwkakcd4akfhOcehiinaigvcethiavaO6mbkcbhOaqcuavcdtgiavcFFFFi0Ecbyd;y:L:cjbHjjjjbbgHBdyaHcFeaiz:xjjjbhXdnadTmbavcufhrcbhkcbhxindnazaeaxcdtfgvydbcdtfydbgiazavclfydbcdtfydbgOSmbaiazavcwfydbcdtfydbgvSmbaOavSmbaPavcdtfydbhAdndnaPaOcdtfydbgvaPaicdtfydbgi9pmbavaA9pmbaAhlaihoavhAxekdnaAai9pmbaAav9pmbaihlavhoxekavhlaAhoaihAkabakcx2fgvaABdbavcwfaoBdbavclfalBdbdnaXaoc:3F;N8N2alc:F:b:DD27aAc;D;O:B8J27arGgOcdtfgvydbgicuSmbcehHinaHhvdnabaicx2fgiydbaA9hmbaiydlal9hmbaiydwaoSmikavcefhHaXaOavfarGgOcdtfgvydbgicu9hmbkkavakBdbakcefhkkaxcifgxad6mbkakci2hOkcwhvaDTmekaDawUdbkavcdthvaqcxfc98fhiinaiavfydbcbyd;C:L:cjbH:bjjjbbavc98fgvmbkaqc;Wbf8KjjjjbaOk:0iewuabcFeaecdtz:xjjjbhbdnalmbcbskaecufhvdndnaiTmbcbhocbhrindndndnabaiarcdtgwfydbgDcm4aD7c:v;t;h;Ev2gecs4ae7avGgqcdtfgkydbgxcuSmbceheinaiaxcdtgxfydbaDSmdaqaefhxaecefheabaxavGgqcdtfgkydbgxcu9hmbkkakarBdbaoheaocefhoxekadaxfydbhekadawfaeBdbarcefgral9hmbxdkkcbhocbhDindnabaDcm4aD7c:v;t;h;Ev2gecs4ae7avGgqcdtfgkydbgxcuSmbaxaDSmbceheinabaqaefavGgqcdtfgkydbgxcuSmeaecefheaxaD9hmbkkdndnaxcu9hmbakaDBdbaoheaocefhoxekadaxcdtfydbhekadaDcdtfaeBdbaDcefgDal9hmbkkaok:3ldrue9:8Jjjjjbc;Wb9Rgr8Kjjjjbcbhwarcxfcbc;Kbz:xjjjb8AdnabaeSmbabaeadcdtz:wjjjb8AkarcualcdtalcFFFFi0EgDcbyd;y:L:cjbHjjjjbbgqBdxarceBd2aqcbaialavcbarcxfz:djjjbcualcx2alc;v:Q;v:Qe0Ecbyd;y:L:cjbHjjjjbbhkarcxfaryd2gxcdtfakBdbaraxcefgmBd2akaialavcbcbz:ejjjb8AarcxfamcdtfaDcbyd;y:L:cjbHjjjjbbgiBdbaraxcdfgvBd2arcxfavcdtfcuaialaeadaqz:fjjjbgecltaecjjjjiGEcbyd;y:L:cjbHjjjjbbgqBdbaqaeaiakalz:gjjjbaxcifhkdnadTmbaoaoNhocbhwabhlcbheindnaqaialydbgvcdtfydbcdtfIdbao9ETmbalclf8PdbhPabawcdtfgDavBdbaDclfaP83dbawcifhwkalcxfhlaecifgead6mbkkdnakTmbaxcdtarcxffcwfhlinalydbcbyd;C:L:cjbH:bjjjbbalc98fhlakcufgkmbkkarc;Wbf8Kjjjjbawk;lOoDud99oue99vuv998Jjjjjbc;Wb9Rgw8KjjjjbdndnarmbcbhDxekawcxfcbc;Kbz:xjjjb8Aawcuadcx2adc;v:Q;v:Qe0Ecbyd;y:L:cjbHjjjjbbgqBdxawceBd2aqaeadaicbcbz:ejjjb8AawcuadcdtadcFFFFi0Egkcbyd;y:L:cjbHjjjjbbgxBdzawcdBd2adcd4adfhecehiinaigmcethiamae6mbkcbhPawcuamcdtgsamcFFFFi0Ecbyd;y:L:cjbHjjjjbbgzBdCawciBd2dndnar:ZgH:rJbbbZMgO:lJbbb9p9DTmbaO:Ohixekcjjjj94hikamcufhAc:bwhCcbhXadhQcbhLinaiaCcufgeaiae9iEaPcefaiaP9kEhDdndnadTmbaDcuf:YhOaqhiaxheadhKindndnaiIdbaONJbbbZMgY:lJbbb9p9DTmbaY:Oh8Axekcjjjj94h8Aka8AcCth8AdndnaiclfIdbaONJbbbZMgY:lJbbb9p9DTmbaY:OhExekcjjjj94hEkaEcqta8AVh8AdndnaicwfIdbaONJbbbZMgY:lJbbb9p9DTmbaY:OhExekcjjjj94hEkaea8AaEVBdbaicxfhiaeclfheaKcufgKmbkazcFeasz:xjjjbh3cbh5cbh8Eindna3axa8Ecdtfydbg8Acm4a8A7c:v;t;h;Ev2gics4ai7aAGgKcdtfgEydbgecuSmbaea8ASmbcehiina3aKaifaAGgKcdtfgEydbgecuSmeaicefhiaea8A9hmbkkaEa8ABdba5aecuSfh5a8Ecefg8Ead9hmbxdkkazcFeasz:xjjjb8Acbh5kdnaQ:ZgYaH:taD:YgOaC:Y:tg8FNaX:Zgaa5:Zgh:tNaaaH:taOaP:Y:tggNahaY:tNMg8JJbbbb9BmbaYaa:taga8FahaH:tNNNa8J:vaOMhOkaPaDa5ar0geEhPaXa5aeEhXdna5arSmbaDaCaeEgCaP9Rcd9imbdndnaLcl0mbdnaOJbbbZMgO:lJbbb9p9DTmbaO:Ohixdkcjjjj94hixekaPaCfcd9Thika5aQaeEhQaLcefgLcs9hmekkdndnaXmbcihicbhDxekawakcbyd;y:L:cjbHjjjjbbg8ABdKawclBd2aPcuf:YhYdnadTmbaqhiaxheadhKindndnaiIdbaYNJbbbZMgO:lJbbb9p9DTmbaO:OhExekcjjjj94hEkaEcCthEdndnaiclfIdbaYNJbbbZMgO:lJbbb9p9DTmbaO:Oh3xekcjjjj94h3ka3cqtaEVhEdndnaicwfIdbaYNJbbbZMgO:lJbbb9p9DTmbaO:Oh3xekcjjjj94h3kaeaEa3VBdbaicxfhiaeclfheaKcufgKmbkkawcuazama8Aaxadz:mjjjbgDc32giaDc;j:KM;jb0Ecbyd;y:L:cjbHjjjjbbgeBd3awcvBd2aecbaiz:xjjjbh3avcd4hxdnadTmbdnalTmbaxcdth8Ea8AhEaqhealhKadhAina3aEydbc32fgiaeIdbaiIdbMUdbaiaeclfIdbaiIdlMUdlaiaecwfIdbaiIdwMUdwaiaKIdbaiIdxMUdxaiaKclfIdbaiIdzMUdzaiaKcwfIdbaiIdCMUdCaiaiIdKJbbjZMUdKaEclfhEaecxfheaKa8EfhKaAcufgAmbxdkka8AhKaqheadhEina3aKydbc32fgiaeIdbaiIdbMUdbaiaeclfIdbaiIdlMUdlaiaecwfIdbaiIdwMUdwaiaiIdxJbbbbMUdxaiaiIdzJbbbbMUdzaiaiIdCJbbbbMUdCaiaiIdKJbbjZMUdKaKclfhKaecxfheaEcufgEmbkkdnaDTmba3hiaDheinaiaiIdbJbbbbJbbjZaicKfIdbgO:vaOJbbbb9BEgONUdbaiclfgKaOaKIdbNUdbaicwfgKaOaKIdbNUdbaicxfgKaOaKIdbNUdbaiczfgKaOaKIdbNUdbaicCfgKaOaKIdbNUdbaic3fhiaecufgembkkcbhEawcuaDcdtgCaDcFFFFi0Egicbyd;y:L:cjbHjjjjbbgeBdaawcoBd2awaicbyd;y:L:cjbHjjjjbbg8EBd8KaecFeaCz:xjjjbh5dnadTmbaoJbbjZJbbjZaY:vaPceSENgOaONhYaxcdthxalheinaYaecN:H:cjbalEgKIdwa3a8AydbgAc32fgiIdC:tgOaONaKIdbaiIdx:tgOaONaKIdlaiIdz:tgOaONMMNaqcwfIdbaiIdw:tgOaONaqIdbaiIdb:tgOaONaqclfIdbaiIdl:tgOaONMMMhOdndna5aAcdtgifgKydbcuSmba8EaifIdbaO9ETmekaKaEBdba8EaifaOUdbka8Aclfh8AaqcxfhqaeaxfheadaEcefgE9hmbkkaba5aCz:wjjjb8Acrhikaicdthiawcxfc98fheinaeaifydbcbyd;C:L:cjbH:bjjjbbaic98fgimbkkawc;Wbf8KjjjjbaDk:Pdidui99ducbhi8Jjjjjbca9Rglcbyd1:G:cjbBdKalcb8Pdj:G:cjb83izalcbydN:G:cjbBdwalcb8Pd:m:G:cjb83ibdndnaembJbbjFhvJbbjFhoJbbjFhrxekadcd4cdthwincbhdinalczfadfgDabadfIdbgvaDIdbgoaoav9EEUdbaladfgDavaDIdbgoaoav9DEUdbadclfgdcx9hmbkabawfhbaicefgiae9hmbkalIdwalIdK:thralIdlalIdC:thoalIdbalIdz:thvkJbbbbavavJbbbb9DEgvaoaoav9DEgvararav9DEk:H8Modui99lud99Aus998Jjjjjbcji9RgD8KjjjjbcbhqaDcxfcbc;Kbz:xjjjb8AaDcbBdwaD9cb83ibaDcbyd;i:L:cjbBd1eaDcb8Pd;a:L:cjb83ijeaDcbyd;u:L:cjbBd94aDcb8Pd;m:L:cjb83i9WdndnavmbJbbjFhkJbbjFhxJbbjFhmxekaocd4cdthPalhsincbhzinaDcjefazfgHasazfIdbgkaHIdbgxaxak9EEUdbaDc;WbfazfgHakaHIdbgxaxak9DEUdbazclfgzcx9hmbkasaPfhsaqcefgqav9hmbkaDId94aDId1e:thmaDIdtaDId:ee:thxaDId9WaDIdje:thkkJbbbbhOdnar:YgAJq;x8J88MaA:vJbbbbakakJbbbb9DEgkaxaxak9DEgkamamak9DENgxJbbbb9Bmbarc9:f:Yax:vhOkaDcCfhCaDcxfcxfhXcbhzinaDazfaDcjefazfIdbgkaxaDc;WbfazfIdbak:t:tJbbb:;NMUdbazclfgzcx9hmbkcbhQaDarar2gLar2gzcbyd;y:L:cjbHjjjjbbgHBdxaDceBd2aHcbazz:xjjjbgKcbcbadaialaoaraOaDawz:rjjjbcdhYaDcuaLcdtaLcFFFFi0Eg8Acbyd;y:L:cjbHjjjjbbgEBdzaDcdBd2aDcjefcbarz:xjjjb8Acbh3dnaLTmbdnarcb9kmbaKhzaEhHaLhsincbh3aHcbcuazaDcjefarz:AjjjbEBdbazarfhzaHclfhHascufgsmbxdkkaKhPcbh3cbhvindndnaKavar2faDcjefarz:AjjjbTmbcbhHaPhzarhsinazaHazRbbgqfgHcbaqE86bbazcefhzascufgsmbkaEavcdtfa3BdbaHa3fh3xekaEavcdtfcuBdbkaParfhPavcefgvaL9hmbkkdnabTmbaDcua3cotgza3cFFF8F0Ecbyd;y:L:cjbHjjjjbbgQBdCcihYaDciBd2aQcbazz:xjjjb8AaXhCkdnawceGmbaCa8Acbyd;y:L:cjbHjjjjbbg5BdbaDaYcefgzBd2aDcxfazcdtfaLcbyd;y:L:cjbHjjjjbbgzBdbaDaYcdfgYBd2azcbaLz:xjjjbh8EarcufhXdnarci9imbarc9:fhCararcef2aKfcefh8Aceh8Fina8Far2hPa8AhvcehqindnaEaqaPfcdtfydbcuSmbavhzaChHinazazRbbgscuasE86bbazcefhzaHcufgHmbkkavarfhvaqcefgqaX9hmbka8AaLfh8Aa8Fcefg8FaX9hmbkkarce9imbcbh8Acbhqcbhvina8EaqfhscbhzindnasazfgHRbbmbaHce86bba5a8AcdtfaqazfBdba8Acefh8Akarazcefgz9hmbkaqarfhqavcefgvar9hmbka8ATmbaKcefhaaKc9:fhharc9:fhgarci9ih8Jina8Ea5a8Acufg8Acdtfydbgvfcb86bbavar2hPdna8JmbaEavcdtfydbcuSmbaKaPfhHaghqindnaHcefgzRbbgscFe9hmbaHRbbmbcbhskazas86bbazhHaqcufgqmbkaharavcef2fhzaXhsindnazRbbgHcFe9hmbazcefRbbmbcbhHkazaH86bbazcufhzascufgsce9kmbkkaaaPfh8Kavavar9Ug8Lar29Rh8FcbhCindnaCceScuaCEa8Ffgzce9imbazaX9ombcuaCciSaCcdSEa8LfgHce9imbaHaX9ombaEaHar2azfg8McdtfydbcuSmba8Jmbaaa8Mar2fhzcbhqa8KhsaghvinazazRbbgHcbaHaHcFeSEasRbbEgP86bbascefhsazcefhzaPaH7aqVhqavcufgvmbkaqcFeGTmba8Ea8MfgzRbbmbazce86bba5a8Acdtfa8MBdba8Acefh8AkaCcefgCcl9hmbka8AmbkkdnaQTmbaKaEaQadaialaoaraOaDawz:rjjjba3TmbJbbjZaO:vhkawcjjjjlGhPdnawcdGTmbJbbnnaOaON:vh8NakJbbbZNhyaQhzinazczfgsIdbg8PazcCfIdbgx:vhmazcxfgqIdbgIax:vhAazcwfgvIdbg8Rax:vh8SakazydbgHcFrG:ZNhRakaHcq4cFrG:ZNh8UakaHcC4cFrG:ZNh8VdnaxJ:p;c;188Ng8WazcKfIdbMg8X:laxJ:983:g81Ngx9ETmba8Wazc3fIdbMazc8KfIdbg8Ya8Ya8X:vg8YN:tg8Z:lax9ETmba8WazcafIdbMazcyfIdbg8Wa8Wa8X:vg80N:tazc8SfIdba8Wa8YN:tg8Wa8Wa8Z:vg8WN:tg81:lax9ETmba8PJ:p;c;188NazcUfIdb:ta80a8RJ:p;c;188Nazc8WfIdb:tg8PN:ta8WaIJ:p;c;188Nazc80fIdb:ta8Ya8PN:tgIN:ta81:vgxam:tg8Ra8RNa8Pa8X:va8YaIa8Z:va8WaxN:tg8XN:ta80axN:tg8Wa8S:tg8Ya8YNa8XaA:tg8Ya8YNMMa8N9DTmbaxaRaxaR9EEgxakaRMgmaxam9DEhma8Xa8Ua8Xa8U9EEgxaka8UMgAaxaA9DEhAa8Wa8Va8Wa8V9EEgxaka8VMg8Saxa8S9DEh8SkdnaPTmbayaRMhmaya8UMhAaya8VMh8SkasamUdbaqaAUdbava8SUdbazc;abfhza3cufg3mbxdkkdnaPTmbakJbbbZNhxaQhzinazczfaxakazydbgHcFrG:ZNMUdbazcxfaxakaHcq4cFrG:ZNMUdbazcwfaxakaHcC4cFrG:ZNMUdbazc;abfhza3cufg3mbxdkkaQcCfhzinazc98fgHaHIdbazIdbgk:vUdbazc94fgHaHIdbak:vUdbazctfgHaHIdbak:vUdbazc;abfhza3cufg3mbkkcbhsdndnarcd9imbarcufh3aEarcdtfhadnabmbaKcefg8Mararcefgz2fh8JaKazfhba8MaLfh8Ecbhscbh8Kina8Kar2h8La8Mheabh8Aa8Eh8Fa8Jh5cbhXindnaEaXa8LfgqcdtgzfgHclfydbaHydbGaaazfgzydbGazclfydbGcuSmbclcbaKaqar2fgzarfRbbEazRbbcb9hVczcbazaLfgzRbbEVc;abcbazarfRbbEVhPaehza8AhHa8Fhqa5hva3hQindnaPclcbaHRbbEazRbbcb9hVczcbaqRbbEVc;abcbavRbbEVgPcetVgCTmbaCcFeSmbasaCRb;W;p:cjbfhskazcefhzaHcefhHaqcefhqavcefhvaQcufgQmbkkaearfhea8Aarfh8Aa8Farfh8Fa5arfh5aXcefgXa39hmbka8MaLfh8MabaLfhba8EaLfh8Ea8JaLfh8Ja8Kcefg8Ka39hmbxdkkJbbjZaO:vgkakJk;x8J88NNh8RawcdGh8EaDIdwhkaDIdlhxaDIdbhmcbhscbhPinaPar2h8KcbhvindnaEava8KfgqcdtgzfgHclfydbaHydbGaaazfgzydbGazclfydbGcuSmbcbh8AclcbaKaqar2fgYarfRbbEaYRbbcb9hVczcbaYaLfg8JRbbEVc;abcba8JarfRbbEVh8Lindna8LclcbaYa8Ag8Mcefg8AfgzarfRbbEazRbbcb9hVczcba8Ja8AfgzRbbEVc;abcbazarfRbbEVg8LcetVgCTmbaCcFeSmbcbhqdndndnaCRb;W;n:cjbcufPdebdka8ETmeaCcC2gz8Ve;W:L:cjbcltaz8Ve;Y:L:cjbcsGVh8FaKa8Mfh5cxhzaDcjefhHinaHaQaEa8Faz4gqce4ceGavfaqcd4ceGaPfar2fgXcdtfydbcotfa5aqceGfaXar2fRbbcotfcnfBdbaHclfhHazc98fgzc989hmbkaDydjegzIdyaDyd:megHIdyMaDyd:eegqIdyaDyd1egXIdyMMg8XaqIdwaXIdwMJbbbZNgANazIdUaHIdUMaqIdUaXIdUMMg8WMg8Sa8SMazIdaaHIdaMaqIdaaXIdaMMg8YaqIdzaXIdzMJbbbZNg8SNMa8SNazId8SaHId8SMaqId8SaXId8SMMgRa8SNazId80aHId80MaqId80aXId80MMg8UMg8Sa8SMazId3aHId3MaqId3aXId3MMg8VaqIdxaXIdxMJbbbZNg8SNMa8SNazId8KaHId8KMaqId8KaXId8KMMg8Za8SNazId8WaHId8WMaqId8WaXId8WMMg80Mg8Sa8SMazIdKaHIdKMaqIdKaXIdKMMgyaANMaANazId88aHId88MaqId88aXId88MMg8PMMM:lgIa8RazIdCaHIdCMaqIdCaXIdCMMN9Ea8XazIdwaHIdwMJbbbZNgANa8WMg8Sa8SMa8YazIdzaHIdzMJbbbZNg8SNMa8SNaRa8SNa8UMg8Sa8SMa8VazIdxaHIdxMJbbbZNg8SNMa8SNa8Za8SNa80Mg8Sa8SMayaANMaANa8PMMM:laIJ;d;1UZN9DGhqxekaKa8Mfh8FcbhzcrhHindnaCaz4ceGTmba8FazceGfazce4ceGavfazcd4aPfar2fgqar2fRbbgXcFeSmbaQaEaqcdtfydbcotfaXcotfc9efRbbaH4ceGTmbcbhqxdkaHcufhHcehqazcefgzcw9hmbkkaCcC2aqcq2fgH8Ve;W:L:cjbgzTmbaHc;Y:L:cjbfhqaKa8MfhCabasc8K2fhHindnasae9pmbaHaQaEazcD4ceGavfazcq4ceGaPfar2fgXcdtfydbcotfaCazcw4ceGfaXar2fRbbcotfgXc9ifIdbamMUdbaHclfaXc9mfIdbaxMUdbaHcwfaXc9qfIdbakMUdbaHcxfamaQaEazcv4ceGavfazco4ceGaPfar2fgXcdtfydbcotfaCazcl4ceGfaXar2fRbbcotfgXc9ifIdbMUdbaHczfaxaXc9mfIdbMUdbaHcCfakaXc9qfIdbMUdbaHcKfamaQaEazce4ceGavfazcd4ceGaPfar2fgXcdtfydbcotfaCazceGfaXar2fRbbcotfgzc9ifIdbMUdbaHc3faxazc9mfIdbMUdbaHcafakazc9qfIdbMUdbkaHc8KfhHascefhsaq8Vebhzaqcdfhqazmbkka8Aa39hmbkkavcefgva39hmbkaPcefgPa39hmbkaDyd2gYTmekaYcdtaDcxffc98fhzinazydbcbyd;C:L:cjbH:bjjjbbazc98fhzaYcufgYmbkkaDcjif8Kjjjjbask;Kxmiue99due99euz99eui99eud99dud99oudnalTmbaocd4hkaqcdGhxarc99fhqarcethmawawMhPcbhsindndnawavaiascdtfgoclfydbak2cdtfgzIdwgHavaoydbak2cdtfgOIdwgA:tgCaCNazIdbgXaOIdbgQ:tgLaLNazIdlgKaOIdlgY:tg8Aa8ANMMgEavaocwfydbak2cdtfgoIdwg3aA:tg5a5NaoIdbg8EaQ:tg8Fa8FNaoIdlgaaY:tghahNMMggaEag9EEgEa3aH:tgHaHNa8EaX:tgHaHNaaaK:tgHaHNMMgHaEaH9EE:rNgHaHMgH:lJbbb9p9DTmbaH:Ohoxekcjjjj94hokdnaLahNa8Aa8FN:tgHaHNa8Aa5NaCahN:tgXaXNaCa8FNaLa5N:tgKaKNMMg3Jbbbb9BmbJbbjZhEdnaoceaoce9kEgoamaoam9iEg8Jcd9imbJbbjZa8J:Z:vhEkarcb9imbaAaDIdw:th8KaYaDIdl:th8LaQaDIdb:th8Ma8Jcba8Jcb9kEh8NdnadTmbaHJbbjZa3:rgA:vgQNg3aAa8Jcefa8Jcdf2:Y:vgANh8EaKaQNgKaANhyaXaQNgXaXaANNh8PcbhIina8Jcba8Jcb9kEcefh8RaEaI:ZNgQaCNa8KMhgaQa8ANa8LMh8SaQaLNa8MMhRcbhzindndnaPaEaz:ZNgQahNa8SMgYNgH:lJbbb9p9DTmbaH:OhOxekcjjjj94hOkaOce91goaqaoaq6Eh8UdndnaPaQa5NagMgHNga:lJbbb9p9DTmbaa:Oh8Vxekcjjjj94h8Vka8Ua8Vce91goaqaoaq6Eg8Wcefar2fcefgoar2h8XdndnaPaQa8FNaRMgQNga:lJbbb9p9DTmbaa:Oh8Yxekcjjjj94h8Ykadaeaocdtfydbcotfaba8Yce91goaqaoaq6Eg8Zfa8XfcefRbbcotfgocnfa8Ucqta8ZcCtVa8WVBdbaoc9efg8Ua8URbbcea8YceGaOcetcdGVa8VcdtclGVtV86bbaoc9ifgOaQaANaOIdbMUdbaoc9mfgOaYaANaOIdbMUdbaoc9qfgOaHaANaOIdbMUdbaoc9ufgOaAaOIdbMUdbdnaxTmbaoc9yfgOa8PaOIdbMUdbaoc9CfgOaKayNaOIdbMUdbaoc9GfgOa3a8ENaOIdbMUdbaoc9KfgOaXayNaOIdbMUdbaoc9OfgOaXa8ENaOIdbMUdbaoc2fgOaKa8ENaOIdbMUdbaoc9WfgOaXaAa3aHNaXaQNaKaYNMMgY:mNgQNaOIdbMUdbaoctfgOaKaQNaOIdbMUdbaoc94fgOa3aQNaOIdbMUdbaoc98fgoaoIdbaYaQN:tUdbka8Razcefgz9hmbka8Jcufh8JaIa8NShoaIcefhIaoTmbxdkkcbh8Vina8Jcba8Jcb9kEcefh8UaEa8V:ZNgAaCNa8KMhYaAa8ANa8LMhHaAaLNa8MMhXcbhoindndnaPaEao:ZNgAahNaHMNgQ:lJbbb9p9DTmbaQ:Ohzxekcjjjj94hzkazce91gzaqazaq6EhzdndnaPaAa5NaYMNgQ:lJbbb9p9DTmbaQ:OhOxekcjjjj94hOkazaOce91gOaqaOaq6Ecefar2fcefar2hzdndnaPaAa8FNaXMNgA:lJbbb9p9DTmbaA:OhOxekcjjjj94hOkabaOce91gOaqaOaq6Efazfcefce86bba8Uaocefgo9hmbka8Jcufh8Ja8Va8NShoa8Vcefh8VaoTmbkkascifgsal6mbkkk:Nvezu8Jjjjjbcjd9Rgb8Kjjjjbcbheabcbcjdz:xjjjbhdc:W:H:cjbhbinabRbbgicC2glabcqf8Veb87e;4:L:cjbalabcdfgv8Peb83e;W:L:cjbaiabcefRbb86b;W;n:cjbadaifce86bbalavabcxfceaetc:F:d;avGEgi8Peb83e;6:L:cjbalai8Vew87e:c:M:cjbabcQfhbaecefgecK9hmbkcbhoinc;Y:L:cjbhrcbhvindnadavfgwRbbce9hmbavcC2c;W:L:cjbfhDcbhbcehqavc;W;n:cjbfhkinabcitc:G:H:cjbfhlcbhbcbheinaeavab4ceGalabfRbbtVheabcefgbcw9hmbkdnadaecFeGgxfgmRbbmbaxcC2c;W:L:cjbfhPcbhbcehsindnaDabcq2gif8VebgbTmbaraifheaPaifhiinaialabcl4csGfRbbcltalabcw4csGfRbbcwtValabcsGfRbbV87ebaicdfhiae8VebhbaecdfheabmbkkcehbasceGhecbhsaembkamce86bbaxakRbb86b;W;n:cjbkcehbaqceGhlcbhqalmbkawcd86bbkarcCfhravcefgvcjd9hmbkaocefgoci9hmbkcbhic;W:L:cjbhvincuhlavhbinalcefhlab8Vebheabcdfhbaembkaial86b;W;p:cjbavcCfhvaicefgicjd9hmbkadcjdf8Kjjjjbk9DeeuabcFeaicdtz:xjjjbhlcbhbdnadTmbindnalaeydbcdtfgiydbcu9hmbaiabBdbabcefhbkaeclfheadcufgdmbkkabk;Bidqui998Jjjjjbc;Wb9Rgl8Kjjjjbalcxfcbc;Kbz:xjjjb8Aadcd4adfhvcehoinaogrcethoarav6mbkalcuarcdtgoarcFFFFi0Ecbyd;y:L:cjbHjjjjbbgvBdxavcFeaoz:xjjjbhwdnadTmbaicd4hDarcufhqcbhkindndnawcbaeakaD2cdtfgrydlgiaicjjjj94SEgocH4ao7c:F:b:DD2cbarydbgxaxcjjjj94SEgocH4ao7c;D;O:B8J27cbarydwgmamcjjjj94SEgrcH4ar7c:3F;N8N27aqGgvcdtfgrydbgocuSmbam::hPai::hsax::hzcehiinaihrdnaeaoaD2cdtfgiIdbaz9CmbaiIdlas9CmbaiIdwaP9BmikarcefhiawavarfaqGgvcdtfgrydbgocu9hmbkkarakBdbakhokabakcdtfaoBdbakcefgkad9hmbkkalydxcbyd;C:L:cjbH:bjjjbbalc;Wbf8Kjjjjbk9teiucbcbyd;G:L:cjbgeabcifc98GfgbBd;G:L:cjbdndnabZbcztgd9nmbcuhiabad9RcFFifcz4nbcuSmekaehikaik;LeeeudndnaeabVciGTmbabhixekdndnadcz9pmbabhixekabhiinaiaeydbBdbaiclfaeclfydbBdbaicwfaecwfydbBdbaicxfaecxfydbBdbaeczfheaiczfhiadc9Wfgdcs0mbkkadcl6mbinaiaeydbBdbaeclfheaiclfhiadc98fgdci0mbkkdnadTmbinaiaeRbb86bbaicefhiaecefheadcufgdmbkkabk;aeedudndnabciGTmbabhixekaecFeGc:b:c:ew2hldndnadcz9pmbabhixekabhiinaialBdbaicxfalBdbaicwfalBdbaiclfalBdbaiczfhiadc9Wfgdcs0mbkkadcl6mbinaialBdbaiclfhiadc98fgdci0mbkkdnadTmbinaiae86bbaicefhiadcufgdmbkkabk9teiucbcbyd;G:L:cjbgeabcrfc94GfgbBd;G:L:cjbdndnabZbcztgd9nmbcuhiabad9RcFFifcz4nbcuSmekaehikaikTeeucbabcbyd;G:L:cjbge9Rcifc98GaefgbBd;G:L:cjbdnabZbcztge9nmbabae9RcFFifcz4nb8Akk6eiucbhidnadTmbdninabRbbglaeRbbgv9hmeaecefheabcefhbadcufgdmbxdkkalav9Rhikaikk;0vdbcj:Gdk;yvFFuuFFuuFFuuFFuFFFuFFFuFbbbbbbbbebbbdbbbbbbbebbbebbbdbbbbbbbbbbbeeeeeebebbeebbebbebbbeeebbbbebbbbbbbbbbbbbbbbbbbeeeeeeebebbbeeebbeebbbbbebbbbbebebbbbbbbbbbbbbbbdiorbelvlbodveribbbbbbbbbbbbbbbbbbbbbbebbbbbbbbbbbbbbbbbbbbbibbbbbbbbbbbbbbbbbbbbbobbbbbbbbbbbbbbbbbbbbbrbaebbbbbbbbbbbbbbbbbbsd8We8YbbbbbbbhiaebbbbbbQe8Ke9cebbbbbbbbbbbbbbbbLb8KebbbbbbbbbbbbbbbbbbKbbbbbbbbbbbbbbbbbbbbbYeJbilbbbbbbbbbbbbbbbbEe80e8WlbbbbbbzlAbbbbbbb5eJdnibbbbbbai8Kbbbbbbb8Ee9ce8Ylcibbbb8Yebbbbbbbb8FdOlAdbbbbbb80e8Ylbbbbbb88eTi8KiJv8Jlbbbbbbbbbbbb89e9td8Kv9qibbbbndlvaibbbbZd8Li8KvbbbbbbJdTibbbbbb9Pe81b9GvoiBvbbbbbbbbbbbb9Re9JbvoWibbbbvibbbbbbbb9VeWi9Gvbbbbbb8WvBbbbbbbb9:b9ceBvbbbbbbbbbbbbbbbbubWibbbbbbbbbbbbbbbbbb;Wd9hvSrbbbbbbWl9NvbbbbbbFbbbbbbbbbbbbbbbbbbbbbFFuuFFuuFFuuFFuFFFuFFFuFbc;y:Ldkxebbbdbbb;W:Obb';
	var wasmpack = new Uint8Array([
		32, 0, 65, 2, 1, 106, 34, 33, 3, 128, 11, 4, 13, 64, 6, 253, 10, 7, 15, 116, 127, 5, 8, 12, 40, 16, 19, 54, 20, 9, 27, 255, 113, 17, 42, 67,
		24, 23, 146, 148, 18, 14, 22, 45, 70, 69, 56, 114, 101, 21, 25, 63, 75, 136, 108, 28, 118, 29, 73, 115,
	]);
	if (typeof WebAssembly !== 'object') {
		return {
			supported: false,
		};
	}
	var instance;
	var ready = WebAssembly.instantiate(unpack(wasm), {}).then(function (result) {
		instance = result.instance;
		instance.exports.__wasm_call_ctors();
	});
	function unpack(data) {
		var result = new Uint8Array(data.length);
		for (var i = 0; i < data.length; ++i) {
			var ch = data.charCodeAt(i);
			result[i] = ch > 96 ? ch - 97 : ch > 64 ? ch - 39 : ch + 4;
		}
		var write = 0;
		for (var i = 0; i < data.length; ++i) {
			result[write++] = result[i] < 60 ? wasmpack[result[i]] : (result[i] - 60) * 64 + result[++i];
		}
		return result.buffer.slice(0, write);
	}
	function assert(cond) {
		if (!cond) {
			throw new Error('Assertion failed');
		}
	}
	function bytes(view) {
		return new Uint8Array(view.buffer, view.byteOffset, view.byteLength);
	}
	function genremap(fun, positions, vertices, stride) {
		var sbrk = instance.exports.sbrk;
		var rp = sbrk(vertices * 4);
		var sp = sbrk(vertices * stride * 4);
		var heap = new Uint8Array(instance.exports.memory.buffer);
		heap.set(bytes(positions), sp);
		fun(rp, sp, vertices, stride * 4);
		heap = new Uint8Array(instance.exports.memory.buffer);
		var remap = new Uint32Array(vertices);
		new Uint8Array(remap.buffer).set(heap.subarray(rp, rp + vertices * 4));
		sbrk(rp - sbrk(0));
		return remap;
	}
	function reorder(fun, indices, vertices) {
		var sbrk = instance.exports.sbrk;
		var ip = sbrk(indices.length * 4);
		var rp = sbrk(vertices * 4);
		var heap = new Uint8Array(instance.exports.memory.buffer);
		var indices8 = bytes(indices);
		heap.set(indices8, ip);
		var unique = fun(rp, ip, indices.length, vertices);
		heap = new Uint8Array(instance.exports.memory.buffer);
		var remap = new Uint32Array(vertices);
		new Uint8Array(remap.buffer).set(heap.subarray(rp, rp + vertices * 4));
		sbrk(ip - sbrk(0));
		for (var i = 0; i < indices.length; ++i) indices[i] = remap[indices[i]];
		return [remap, unique];
	}
	function maxindex(source) {
		var result = 0;
		for (var i = 0; i < source.length; ++i) {
			var index = source[i];
			result = result < index ? index : result;
		}
		return result;
	}
	function simplify(fun, indices, index_count, vertex_positions, vertex_count, vertex_positions_stride, target_index_count, target_error, options) {
		var sbrk = instance.exports.sbrk;
		var te = sbrk(4);
		var ti = sbrk(index_count * 4);
		var sp = sbrk(vertex_count * vertex_positions_stride);
		var si = sbrk(index_count * 4);
		var heap = new Uint8Array(instance.exports.memory.buffer);
		heap.set(bytes(vertex_positions), sp);
		heap.set(bytes(indices), si);
		var result = fun(ti, si, index_count, sp, vertex_count, vertex_positions_stride, target_index_count, target_error, options, te);
		heap = new Uint8Array(instance.exports.memory.buffer);
		var target = new Uint32Array(result);
		bytes(target).set(heap.subarray(ti, ti + result * 4));
		var error = new Float32Array(1);
		bytes(error).set(heap.subarray(te, te + 4));
		sbrk(te - sbrk(0));
		return [target, error[0]];
	}
	function simplifyAttr(
		fun,
		indices,
		index_count,
		vertex_positions,
		vertex_count,
		vertex_positions_stride,
		vertex_attributes,
		vertex_attributes_stride,
		attribute_weights,
		vertex_lock,
		target_index_count,
		target_error,
		options
	) {
		var sbrk = instance.exports.sbrk;
		var te = sbrk(4);
		var ti = sbrk(index_count * 4);
		var sp = sbrk(vertex_count * vertex_positions_stride);
		var sa = sbrk(vertex_count * vertex_attributes_stride);
		var sw = sbrk(attribute_weights.length * 4);
		var si = sbrk(index_count * 4);
		var vl = vertex_lock ? sbrk(vertex_count) : 0;
		var heap = new Uint8Array(instance.exports.memory.buffer);
		heap.set(bytes(vertex_positions), sp);
		heap.set(bytes(vertex_attributes), sa);
		heap.set(bytes(attribute_weights), sw);
		heap.set(bytes(indices), si);
		if (vertex_lock) {
			heap.set(bytes(vertex_lock), vl);
		}
		var result = fun(
			ti,
			si,
			index_count,
			sp,
			vertex_count,
			vertex_positions_stride,
			sa,
			vertex_attributes_stride,
			sw,
			attribute_weights.length,
			vl,
			target_index_count,
			target_error,
			options,
			te
		);
		heap = new Uint8Array(instance.exports.memory.buffer);
		var target = new Uint32Array(result);
		bytes(target).set(heap.subarray(ti, ti + result * 4));
		var error = new Float32Array(1);
		bytes(error).set(heap.subarray(te, te + 4));
		sbrk(te - sbrk(0));
		return [target, error[0]];
	}
	function simplifyUpdate(
		fun,
		indices,
		index_count,
		vertex_positions,
		vertex_count,
		vertex_positions_stride,
		vertex_attributes,
		vertex_attributes_stride,
		attribute_weights,
		vertex_lock,
		target_index_count,
		target_error,
		options
	) {
		var sbrk = instance.exports.sbrk;
		var te = sbrk(4);
		var sp = sbrk(vertex_count * vertex_positions_stride);
		var sa = sbrk(vertex_count * vertex_attributes_stride);
		var sw = sbrk(attribute_weights.length * 4);
		var si = sbrk(index_count * 4);
		var vl = vertex_lock ? sbrk(vertex_count) : 0;
		var heap = new Uint8Array(instance.exports.memory.buffer);
		heap.set(bytes(vertex_positions), sp);
		heap.set(bytes(vertex_attributes), sa);
		heap.set(bytes(attribute_weights), sw);
		heap.set(bytes(indices), si);
		if (vertex_lock) {
			heap.set(bytes(vertex_lock), vl);
		}
		var result = fun(
			si,
			index_count,
			sp,
			vertex_count,
			vertex_positions_stride,
			sa,
			vertex_attributes_stride,
			sw,
			attribute_weights.length,
			vl,
			target_index_count,
			target_error,
			options,
			te
		);
		heap = new Uint8Array(instance.exports.memory.buffer);
		bytes(indices).set(heap.subarray(si, si + result * 4));
		bytes(vertex_positions).set(heap.subarray(sp, sp + vertex_count * vertex_positions_stride));
		bytes(vertex_attributes).set(heap.subarray(sa, sa + vertex_count * vertex_attributes_stride));
		var error = new Float32Array(1);
		bytes(error).set(heap.subarray(te, te + 4));
		sbrk(te - sbrk(0));
		return [result, error[0]];
	}
	function simplifyScale(fun, vertex_positions, vertex_count, vertex_positions_stride) {
		var sbrk = instance.exports.sbrk;
		var sp = sbrk(vertex_count * vertex_positions_stride);
		var heap = new Uint8Array(instance.exports.memory.buffer);
		heap.set(bytes(vertex_positions), sp);
		var result = fun(sp, vertex_count, vertex_positions_stride);
		sbrk(sp - sbrk(0));
		return result;
	}
	function simplifyPoints(
		fun,
		vertex_positions,
		vertex_count,
		vertex_positions_stride,
		vertex_colors,
		vertex_colors_stride,
		color_weight,
		target_vertex_count
	) {
		var sbrk = instance.exports.sbrk;
		var ti = sbrk(target_vertex_count * 4);
		var sp = sbrk(vertex_count * vertex_positions_stride);
		var sc = vertex_colors ? sbrk(vertex_count * vertex_colors_stride) : 0;
		var heap = new Uint8Array(instance.exports.memory.buffer);
		heap.set(bytes(vertex_positions), sp);
		if (vertex_colors) {
			heap.set(bytes(vertex_colors), sc);
		}
		var result = fun(ti, sp, vertex_count, vertex_positions_stride, sc, vertex_colors_stride, color_weight, target_vertex_count);
		heap = new Uint8Array(instance.exports.memory.buffer);
		var target = new Uint32Array(result);
		bytes(target).set(heap.subarray(ti, ti + result * 4));
		sbrk(ti - sbrk(0));
		return target;
	}
	function simplifySloppy(
		fun,
		indices,
		index_count,
		vertex_positions,
		vertex_count,
		vertex_positions_stride,
		vertex_lock,
		target_index_count,
		target_error
	) {
		var sbrk = instance.exports.sbrk;
		var te = sbrk(4);
		var ti = sbrk(index_count * 4);
		var sp = sbrk(vertex_count * vertex_positions_stride);
		var si = sbrk(index_count * 4);
		var vl = vertex_lock ? sbrk(vertex_count) : 0;
		var heap = new Uint8Array(instance.exports.memory.buffer);
		heap.set(bytes(vertex_positions), sp);
		heap.set(bytes(indices), si);
		if (vertex_lock) {
			heap.set(bytes(vertex_lock), vl);
		}
		var result = fun(ti, si, index_count, sp, vertex_count, vertex_positions_stride, vl, target_index_count, target_error, te);
		heap = new Uint8Array(instance.exports.memory.buffer);
		var target = new Uint32Array(result);
		bytes(target).set(heap.subarray(ti, ti + result * 4));
		var error = new Float32Array(1);
		bytes(error).set(heap.subarray(te, te + 4));
		sbrk(te - sbrk(0));
		return [target, error[0]];
	}
	function simplifyPrune(fun, indices, index_count, vertex_positions, vertex_count, vertex_positions_stride, target_error) {
		var sbrk = instance.exports.sbrk;
		var ti = sbrk(index_count * 4);
		var sp = sbrk(vertex_count * vertex_positions_stride);
		var si = sbrk(index_count * 4);
		var heap = new Uint8Array(instance.exports.memory.buffer);
		heap.set(bytes(vertex_positions), sp);
		heap.set(bytes(indices), si);
		var result = fun(ti, si, index_count, sp, vertex_count, vertex_positions_stride, target_error);
		heap = new Uint8Array(instance.exports.memory.buffer);
		var target = new Uint32Array(result);
		bytes(target).set(heap.subarray(ti, ti + result * 4));
		sbrk(ti - sbrk(0));
		return target;
	}
	function remesh(fun, indices, vertex_positions, vertex_positions_stride, resolution, options) {
		var sbrk = instance.exports.sbrk;
		var sp = sbrk(vertex_positions.byteLength);
		var si = sbrk(indices.byteLength);
		var heap = new Uint8Array(instance.exports.memory.buffer);
		heap.set(bytes(vertex_positions), sp);
		heap.set(bytes(indices), si);
		var vertex_count = vertex_positions.byteLength / vertex_positions_stride;
		var capacity = fun(0, 0, si, indices.length, sp, vertex_count, vertex_positions_stride, resolution, options);
		var tp = sbrk(capacity * 9 * 4);
		var count = fun(tp, capacity, si, indices.length, sp, vertex_count, vertex_positions_stride, resolution, options);
		assert(count <= capacity);
		heap = new Uint8Array(instance.exports.memory.buffer);
		var target = new Float32Array(count * 9);
		bytes(target).set(heap.subarray(tp, tp + target.byteLength));
		sbrk(sp - sbrk(0));
		return target;
	}
	var simplifyOptions = {
		LockBorder: 1,
		Sparse: 2,
		ErrorAbsolute: 4,
		Prune: 8,
		Regularize: 16,
		Permissive: 32,
		RegularizeLight: 64,
		PreserveFolds: 128,
		ErrorClamped: 256,
		_InternalDebug: 1 << 30,
	};
	var remeshOptions = {
		Shell: 1,
		Solve: 2,
		Thicken: 0,
		_InternalDebug: 1 << 30,
	};
	return {
		ready: ready,
		supported: true,
		compactMesh: function (indices) {
			assert(
				indices instanceof Uint32Array || indices instanceof Int32Array || indices instanceof Uint16Array || indices instanceof Int16Array
			);
			assert(indices.length % 3 == 0);
			var indices32 = indices.BYTES_PER_ELEMENT == 4 ? indices : new Uint32Array(indices);
			var result = reorder(instance.exports.meshopt_optimizeVertexFetchRemap, indices32, maxindex(indices) + 1);
			if (indices !== indices32) {
				for (var i = 0; i < indices32.length; ++i) {
					indices[i] = indices32[i];
				}
			}
			return result;
		},
		generatePositionRemap: function (vertex_positions, vertex_positions_stride) {
			assert(vertex_positions instanceof Float32Array);
			assert(vertex_positions.length % vertex_positions_stride == 0);
			assert(vertex_positions_stride >= 3);
			return genremap(
				instance.exports.meshopt_generatePositionRemap,
				vertex_positions,
				vertex_positions.length / vertex_positions_stride,
				vertex_positions_stride
			);
		},
		simplify: function (indices, vertex_positions, vertex_positions_stride, target_index_count, target_error, flags) {
			assert(
				indices instanceof Uint32Array || indices instanceof Int32Array || indices instanceof Uint16Array || indices instanceof Int16Array
			);
			assert(indices.length % 3 == 0);
			assert(vertex_positions instanceof Float32Array);
			assert(vertex_positions.length % vertex_positions_stride == 0);
			assert(vertex_positions_stride >= 3);
			assert(target_index_count >= 0 && target_index_count <= indices.length);
			assert(target_index_count % 3 == 0);
			assert(target_error >= 0);
			var options = 0;
			for (var i = 0; i < (flags ? flags.length : 0); ++i) {
				assert(flags[i] in simplifyOptions);
				options |= simplifyOptions[flags[i]];
			}
			var indices32 = indices.BYTES_PER_ELEMENT == 4 ? indices : new Uint32Array(indices);
			var result = simplify(
				instance.exports.meshopt_simplify,
				indices32,
				indices.length,
				vertex_positions,
				vertex_positions.length / vertex_positions_stride,
				vertex_positions_stride * 4,
				target_index_count,
				target_error,
				options
			);
			result[0] = indices instanceof Uint32Array ? result[0] : new indices.constructor(result[0]);
			return result;
		},
		simplifyWithAttributes: function (
			indices,
			vertex_positions,
			vertex_positions_stride,
			vertex_attributes,
			vertex_attributes_stride,
			attribute_weights,
			vertex_lock,
			target_index_count,
			target_error,
			flags
		) {
			assert(
				indices instanceof Uint32Array || indices instanceof Int32Array || indices instanceof Uint16Array || indices instanceof Int16Array
			);
			assert(indices.length % 3 == 0);
			assert(vertex_positions instanceof Float32Array);
			assert(vertex_positions.length % vertex_positions_stride == 0);
			assert(vertex_positions_stride >= 3);
			assert(vertex_attributes instanceof Float32Array);
			assert(vertex_attributes.length == vertex_attributes_stride * (vertex_positions.length / vertex_positions_stride));
			assert(vertex_attributes_stride >= 0);
			assert(vertex_lock == null || vertex_lock instanceof Uint8Array);
			assert(vertex_lock == null || vertex_lock.length == vertex_positions.length / vertex_positions_stride);
			assert(target_index_count >= 0 && target_index_count <= indices.length);
			assert(target_index_count % 3 == 0);
			assert(target_error >= 0);
			assert(Array.isArray(attribute_weights));
			assert(vertex_attributes_stride >= attribute_weights.length);
			assert(attribute_weights.length <= 32);
			for (var i = 0; i < attribute_weights.length; ++i) {
				assert(attribute_weights[i] >= 0);
			}
			var options = 0;
			for (var i = 0; i < (flags ? flags.length : 0); ++i) {
				assert(flags[i] in simplifyOptions);
				options |= simplifyOptions[flags[i]];
			}
			var indices32 = indices.BYTES_PER_ELEMENT == 4 ? indices : new Uint32Array(indices);
			var result = simplifyAttr(
				instance.exports.meshopt_simplifyWithAttributes,
				indices32,
				indices.length,
				vertex_positions,
				vertex_positions.length / vertex_positions_stride,
				vertex_positions_stride * 4,
				vertex_attributes,
				vertex_attributes_stride * 4,
				new Float32Array(attribute_weights),
				vertex_lock,
				target_index_count,
				target_error,
				options
			);
			result[0] = indices instanceof Uint32Array ? result[0] : new indices.constructor(result[0]);
			return result;
		},
		simplifyWithUpdate: function (
			indices,
			vertex_positions,
			vertex_positions_stride,
			vertex_attributes,
			vertex_attributes_stride,
			attribute_weights,
			vertex_lock,
			target_index_count,
			target_error,
			flags
		) {
			assert(
				indices instanceof Uint32Array || indices instanceof Int32Array || indices instanceof Uint16Array || indices instanceof Int16Array
			);
			assert(indices.length % 3 == 0);
			assert(vertex_positions instanceof Float32Array);
			assert(vertex_positions.length % vertex_positions_stride == 0);
			assert(vertex_positions_stride >= 3);
			assert(vertex_attributes instanceof Float32Array);
			assert(vertex_attributes.length == vertex_attributes_stride * (vertex_positions.length / vertex_positions_stride));
			assert(vertex_attributes_stride >= 0);
			assert(vertex_lock == null || vertex_lock instanceof Uint8Array);
			assert(vertex_lock == null || vertex_lock.length == vertex_positions.length / vertex_positions_stride);
			assert(target_index_count >= 0 && target_index_count <= indices.length);
			assert(target_index_count % 3 == 0);
			assert(target_error >= 0);
			assert(Array.isArray(attribute_weights));
			assert(vertex_attributes_stride >= attribute_weights.length);
			assert(attribute_weights.length <= 32);
			for (var i = 0; i < attribute_weights.length; ++i) {
				assert(attribute_weights[i] >= 0);
			}
			var options = 0;
			for (var i = 0; i < (flags ? flags.length : 0); ++i) {
				assert(flags[i] in simplifyOptions);
				options |= simplifyOptions[flags[i]];
			}
			var indices32 = indices.BYTES_PER_ELEMENT == 4 ? indices : new Uint32Array(indices);
			var result = simplifyUpdate(
				instance.exports.meshopt_simplifyWithUpdate,
				indices32,
				indices.length,
				vertex_positions,
				vertex_positions.length / vertex_positions_stride,
				vertex_positions_stride * 4,
				vertex_attributes,
				vertex_attributes_stride * 4,
				new Float32Array(attribute_weights),
				vertex_lock,
				target_index_count,
				target_error,
				options
			);
			if (indices !== indices32) {
				for (var i = 0; i < result[0]; ++i) {
					indices[i] = indices32[i];
				}
			}
			return result;
		},
		getScale: function (vertex_positions, vertex_positions_stride) {
			assert(vertex_positions instanceof Float32Array);
			assert(vertex_positions.length % vertex_positions_stride == 0);
			assert(vertex_positions_stride >= 3);
			return simplifyScale(
				instance.exports.meshopt_simplifyScale,
				vertex_positions,
				vertex_positions.length / vertex_positions_stride,
				vertex_positions_stride * 4
			);
		},
		simplifyPoints: function (vertex_positions, vertex_positions_stride, target_vertex_count, vertex_colors, vertex_colors_stride, color_weight) {
			assert(vertex_positions instanceof Float32Array);
			assert(vertex_positions.length % vertex_positions_stride == 0);
			assert(vertex_positions_stride >= 3);
			assert(target_vertex_count >= 0 && target_vertex_count <= vertex_positions.length / vertex_positions_stride);
			if (vertex_colors) {
				assert(vertex_colors instanceof Float32Array);
				assert(vertex_colors.length % vertex_colors_stride == 0);
				assert(vertex_colors_stride >= 3);
				assert(vertex_positions.length / vertex_positions_stride == vertex_colors.length / vertex_colors_stride);
				return simplifyPoints(
					instance.exports.meshopt_simplifyPoints,
					vertex_positions,
					vertex_positions.length / vertex_positions_stride,
					vertex_positions_stride * 4,
					vertex_colors,
					vertex_colors_stride * 4,
					color_weight || 0,
					target_vertex_count
				);
			} else {
				return simplifyPoints(
					instance.exports.meshopt_simplifyPoints,
					vertex_positions,
					vertex_positions.length / vertex_positions_stride,
					vertex_positions_stride * 4,
					undefined,
					0,
					0,
					target_vertex_count
				);
			}
		},
		simplifySloppy: function (indices, vertex_positions, vertex_positions_stride, vertex_lock, target_index_count, target_error) {
			assert(
				indices instanceof Uint32Array || indices instanceof Int32Array || indices instanceof Uint16Array || indices instanceof Int16Array
			);
			assert(indices.length % 3 == 0);
			assert(vertex_positions instanceof Float32Array);
			assert(vertex_positions.length % vertex_positions_stride == 0);
			assert(vertex_positions_stride >= 3);
			assert(vertex_lock == null || vertex_lock instanceof Uint8Array);
			assert(vertex_lock == null || vertex_lock.length == vertex_positions.length / vertex_positions_stride);
			assert(target_index_count >= 0 && target_index_count <= indices.length);
			assert(target_index_count % 3 == 0);
			assert(target_error >= 0);
			var indices32 = indices.BYTES_PER_ELEMENT == 4 ? indices : new Uint32Array(indices);
			var result = simplifySloppy(
				instance.exports.meshopt_simplifySloppy,
				indices32,
				indices.length,
				vertex_positions,
				vertex_positions.length / vertex_positions_stride,
				vertex_positions_stride * 4,
				vertex_lock,
				target_index_count,
				target_error
			);
			result[0] = indices instanceof Uint32Array ? result[0] : new indices.constructor(result[0]);
			return result;
		},
		simplifyPrune: function (indices, vertex_positions, vertex_positions_stride, target_error) {
			assert(
				indices instanceof Uint32Array || indices instanceof Int32Array || indices instanceof Uint16Array || indices instanceof Int16Array
			);
			assert(indices.length % 3 == 0);
			assert(vertex_positions instanceof Float32Array);
			assert(vertex_positions.length % vertex_positions_stride == 0);
			assert(vertex_positions_stride >= 3);
			assert(target_error >= 0);
			var indices32 = indices.BYTES_PER_ELEMENT == 4 ? indices : new Uint32Array(indices);
			var result = simplifyPrune(
				instance.exports.meshopt_simplifyPrune,
				indices32,
				indices.length,
				vertex_positions,
				vertex_positions.length / vertex_positions_stride,
				vertex_positions_stride * 4,
				target_error
			);
			result = indices instanceof Uint32Array ? result : new indices.constructor(result);
			return result;
		},
		remesh: function (indices, vertex_positions, vertex_positions_stride, resolution, flags) {
			assert(
				indices instanceof Uint32Array || indices instanceof Int32Array || indices instanceof Uint16Array || indices instanceof Int16Array
			);
			assert(indices.length % 3 == 0);
			assert(vertex_positions instanceof Float32Array);
			assert(vertex_positions.length % vertex_positions_stride == 0);
			assert(vertex_positions_stride >= 3);
			assert(resolution >= 4 && resolution <= 256);
			var options = 0;
			for (var i = 0; i < (flags ? flags.length : 0); ++i) {
				assert(flags[i] in remeshOptions);
				options |= remeshOptions[flags[i]];
			}
			var indices32 = indices.BYTES_PER_ELEMENT == 4 ? indices : new Uint32Array(indices);
			return remesh(instance.exports.meshopt_remesh, indices32, vertex_positions, vertex_positions_stride * 4, resolution, options);
		},
	};
})();
return (meshoptLoad.s = MeshoptSimplifier);
}
return { meshoptLoad };
} };
