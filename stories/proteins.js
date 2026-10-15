// Network medicine, told with the proteins in a cell: the protein story.
// Runs inside index.html, which owns the page, the renderer and the headset session.
HOST.register('proteins', function (HOST) {
'use strict';
// Curated, illustrative human protein interaction network (see credits in the story)
const PPI = {"nodes":[["PSMA1","Proteasome alpha 1","proteasome core","C",1,0.8038,0.1051,-0.131,5,0.01785],["PSMA2","Proteasome alpha 2","proteasome core","C",1,0.7336,0.0833,0.0025,5,0.0512],["PSMA3","Proteasome alpha 3","proteasome core","C",1,0.8169,-0.0661,-0.0454,5,0.17487],["PSMA4","Proteasome alpha 4","proteasome core","C",1,0.5521,-0.1663,-0.0931,5,0.03667],["PSMA5","Proteasome alpha 5","proteasome core","C",1,0.6338,-0.2066,-0.2282,5,0.01221],["PSMA6","Proteasome alpha 6","proteasome core","C",1,0.7196,-0.0622,-0.2982,5,0.00376],["PSMA7","Proteasome alpha 7","proteasome core","C",1,0.5963,0.0804,-0.246,5,0.00221],["PSMB1","Proteasome beta 1","proteasome core","C",1,0.589,0.1778,-0.1884,5,0.00583],["PSMB2","Proteasome beta 2","proteasome core","C",1,0.6717,0.1707,-0.0908,5,0.00887],["PSMB3","Proteasome beta 3","proteasome core","C",1,0.7902,0.0309,-0.1498,5,0.01577],["PSMB4","Proteasome beta 4","proteasome core","C",1,0.6502,-0.1129,-0.2177,5,0.00813],["PSMB5","Proteasome beta 5","proteasome core","C",1,0.5648,-0.1276,-0.3166,5,0.00474],["PSMB6","Proteasome beta 6","proteasome core","C",1,0.7213,-0.0061,-0.4528,5,0.00038],["PSMB7","Proteasome beta 7","proteasome core","C",1,0.6221,0.1407,-0.3433,5,0.00029],["PSMC1","Proteasome ATPase 1","proteasome lid motor","C",1,0.6217,-0.0833,0.0173,5,0.00074],["PSMC2","Proteasome ATPase 2","proteasome lid motor","C",1,0.5094,-0.0312,0.0553,5,0.01152],["PSMC3","Proteasome ATPase 3","proteasome lid motor","C",1,0.7816,-0.2106,0.0122,5,0.02241],["PSMC4","Proteasome ATPase 4","proteasome lid motor","C",1,0.6982,-0.3032,0.0277,5,0.01274],["PSMC5","Proteasome ATPase 5","proteasome lid motor","C",1,0.6184,-0.2379,-0.0656,5,0.00052],["PSMC6","Proteasome ATPase 6","proteasome lid motor","C",1,0.756,-0.1083,-0.0943,5,0.00562],["PSMD1","Proteasome non-ATPase 1","proteasome regulator","C",1,0.6827,-0.2937,0.1672,5,0.00012],["PSMD2","Proteasome non-ATPase 2","proteasome regulator","C",1,0.511,-0.1156,0.1124,5,0.00029],["POLR2A","RNA polymerase II A","makes messenger RNA","N",1,-0.0713,-0.1355,0.0096,9,0.10719],["POLR2B","RNA polymerase II B","makes messenger RNA","N",1,-0.101,-0.23,-0.0472,9,0.01967],["POLR2C","RNA polymerase II C","RNA polymerase subunit","N",1,-0.1043,-0.2668,-0.0237,9,0.00397],["POLR2D","RNA polymerase II D","RNA polymerase subunit","N",1,-0.0953,-0.151,0.0405,9,0.0],["POLR2E","RNA polymerase II E","RNA polymerase subunit","N",1,-0.0415,-0.1102,0.0173,9,0.0],["POLR2F","RNA polymerase II F","RNA polymerase subunit","N",1,-0.0742,-0.1922,0.0475,9,0.0],["POLR2G","RNA polymerase II G","RNA polymerase subunit","N",1,-0.1042,-0.1474,0.0306,9,0.0],["POLR2H","RNA polymerase II H","RNA polymerase subunit","N",1,-0.052,-0.1125,0.026,9,2e-05],["POLR2I","RNA polymerase II I","RNA polymerase subunit","N",1,-0.0799,-0.2263,-0.0832,9,0.0],["POLR2J","RNA polymerase II J","RNA polymerase subunit","N",1,-0.0654,-0.2189,-0.0438,9,0.0],["POLR2K","RNA polymerase II K","RNA polymerase subunit","N",1,-0.0619,-0.1734,0.0021,9,0.0],["POLR2L","RNA polymerase II L","RNA polymerase subunit","N",1,-0.0983,-0.1917,-0.0759,9,0.0],["TBP","TATA-binding protein","marks where genes start","N",1,-0.1919,-0.2246,0.0087,9,0.00791],["GTF2B","Transcription factor IIB","positions RNA polymerase","N",1,-0.1835,-0.2553,-0.0005,9,0.0],["TAF1","TFIID subunit 1","promoter recognition","N",0,-0.0803,-0.0688,0.0016,9,0.0],["MED1","Mediator subunit 1","relays signals to RNA polymerase","N",0,0.1237,0.1471,-0.1878,2,0.13411],["MED12","Mediator subunit 12","mediator kinase module","N",0,0.1064,0.1251,-0.1203,2,0.01575],["CDK8","Cyclin-dependent kinase 8","mediator kinase","N",0,0.1669,0.1873,-0.1555,2,0.0],["CCNC","Cyclin C","partner of CDK8","N",0,0.0679,0.0824,-0.0662,2,0.0],["EP300","p300 acetyltransferase","switches genes on","N",0,0.0737,0.0946,-0.149,2,0.28195],["CREBBP","CREB-binding protein","switches genes on","N",0,0.0359,0.0488,-0.081,2,0.05695],["MYC","MYC proto-oncogene","drives cell growth","N",0,0.0184,0.0963,0.0515,0,0.02113],["MAX","MYC-associated factor X","partner of MYC","N",0,0.0228,0.1379,0.0823,0,0.0],["ELK1","ELK1 transcription factor","responds to growth signals","N",0,0.0609,0.0789,0.0923,3,1e-05],["NCOA3","Nuclear receptor coactivator 3","helps the oestrogen receptor","N",0,0.0385,0.0447,-0.083,2,0.0],["ESR1","Oestrogen receptor alpha","hormone-driven gene switch","N",0,0.0565,0.0607,-0.1007,2,0.0626],["SIRT1","Sirtuin 1","stress-response deacetylase","N",0,0.104,0.1548,-0.1835,2,0.0],["HIPK2","HIPK2 kinase","activates p53","N",0,0.1351,0.1688,-0.1936,2,0.0],["CTCF","CTCF insulator protein","organises the genome","N",0,-0.1302,0.1006,0.0834,1,0.0],["MCM2","MCM helicase 2","unwinds DNA for copying","N",1,-0.1158,-0.0627,0.1733,6,0.02519],["MCM3","MCM helicase 3","unwinds DNA for copying","N",1,-0.101,-0.1048,0.1948,6,0.02509],["MCM4","MCM helicase 4","unwinds DNA for copying","N",1,-0.0801,-0.0579,0.1754,6,0.00249],["MCM5","MCM helicase 5","unwinds DNA for copying","N",1,-0.1548,-0.1187,0.2568,6,0.00348],["MCM6","MCM helicase 6","unwinds DNA for copying","N",1,-0.0682,-0.0333,0.1216,6,0.01017],["MCM7","MCM helicase 7","unwinds DNA for copying","N",1,-0.0787,-0.0778,0.1802,6,0.03537],["CDC45","CDC45","replication helicase partner","N",1,-0.055,-0.0422,0.081,6,0.01022],["GINS1","GINS subunit 1","replication helicase partner","N",1,-0.0777,-0.0905,0.1316,6,0.01418],["GINS2","GINS subunit 2","replication helicase partner","N",1,-0.081,-0.1009,0.1286,6,0.0],["GINS3","GINS subunit 3","replication helicase partner","N",1,-0.0715,-0.0818,0.1037,6,0.0],["GINS4","GINS subunit 4","replication helicase partner","N",1,-0.0546,-0.0554,0.081,6,0.00604],["PCNA","PCNA sliding clamp","holds the DNA copier on","N",1,0.0738,0.1799,0.0371,0,0.12744],["POLD1","DNA polymerase delta","copies DNA","N",1,0.1216,0.277,0.0719,0,0.0],["RFC1","Replication factor C","loads the PCNA clamp","N",1,0.0866,0.1894,0.0306,0,0.0],["ORC1","Origin recognition 1","marks where copying starts","N",0,-0.2164,-0.0372,0.2142,6,0.03893],["ORC2","Origin recognition 2","marks where copying starts","N",0,-0.1024,-0.0149,0.0823,6,0.01562],["ORC3","Origin recognition 3","marks where copying starts","N",0,-0.1164,-0.0123,0.0786,6,0.00794],["ORC4","Origin recognition 4","marks where copying starts","N",0,-0.1587,-0.0118,0.1376,6,0.00781],["ORC5","Origin recognition 5","marks where copying starts","N",0,-0.1736,-0.0082,0.129,6,6e-05],["ORC6","Origin recognition 6","marks where copying starts","N",0,-0.1025,-0.0113,0.0589,6,0.0],["CDC6","CDC6","licenses replication origins","N",0,-0.1138,-0.0341,0.1458,6,0.07292],["CDT1","CDT1","licenses replication origins","N",0,-0.1155,-0.0331,0.1835,6,0.03884],["GMNN","Geminin","prevents re-copying DNA","N",0,-0.1031,-0.0161,0.1794,6,0.0],["FEN1","Flap endonuclease 1","trims DNA flaps","N",0,0.0965,0.2424,0.0383,0,0.0],["LIG1","DNA ligase 1","seals DNA","N",0,0.1035,0.216,0.046,0,0.0],["SMC1A","Cohesin SMC1A","holds sister DNA together","N",1,-0.1989,0.2136,0.0745,1,0.06066],["SMC3","Cohesin SMC3","holds sister DNA together","N",1,-0.1419,0.1375,0.0697,1,0.0],["RAD21","Cohesin RAD21","holds sister DNA together","N",1,-0.1667,0.1424,0.0938,1,0.03686],["STAG1","Cohesin SA1","cohesin subunit","N",0,-0.1209,0.112,0.0892,1,0.0],["STAG2","Cohesin SA2","cohesin subunit","N",0,-0.1832,0.1176,0.104,1,0.00801],["PDS5A","PDS5A","cohesin regulator","N",0,-0.1741,0.1254,0.114,1,0.00791],["WAPL","WAPL","releases cohesin","N",0,-0.2111,0.1328,0.1537,1,0.0],["NIPBL","NIPBL","loads cohesin","N",0,-0.1193,0.1629,0.0307,1,0.00791],["MAU2","MAU2","loads cohesin","N",0,-0.152,0.2467,0.0205,1,0.0],["TP53","p53 tumour suppressor","guardian of the genome","N",0,0.1347,0.1554,-0.2211,2,0.36419],["MDM2","MDM2 ubiquitin ligase","keeps p53 in check","N",0,0.0796,0.0758,-0.1202,2,0.17412],["MDM4","MDM4","keeps p53 in check","N",0,0.1482,0.1422,-0.1996,2,0.0],["USP7","USP7 deubiquitinase","stabilises MDM2 and p53","N",0,0.0911,0.0944,-0.1295,2,0.0],["TP53BP1","p53-binding protein 1","guides DNA break repair","N",0,-0.1223,0.2213,0.1134,1,0.00795],["TP53BP2","p53-binding protein 2","helps p53 trigger cell death","N",0,0.0801,0.1199,-0.1535,2,0.0],["BRCA1","BRCA1","repairs broken DNA","N",0,-0.2003,0.2129,0.0288,1,0.10842],["BARD1","BARD1","partner of BRCA1","N",0,-0.0785,0.0832,-0.0002,1,0.0],["BRCA2","BRCA2","loads RAD51 onto DNA","N",0,-0.2346,0.1624,-0.005,1,0.00509],["PALB2","PALB2","links BRCA1 and BRCA2","N",0,-0.2346,0.1974,0.0097,1,0.00547],["RAD51","RAD51 recombinase","repairs DNA by copying","N",0,-0.1372,0.1194,0.0002,1,0.00547],["RBBP8","CtIP","trims broken DNA ends","N",0,-0.1182,0.1665,0.0202,1,0.00601],["BRIP1","BRIP1 helicase","partner of BRCA1","N",0,-0.1174,0.1376,0.0009,1,0.0],["ATM","ATM kinase","senses DNA breaks","N",0,-0.1956,0.2508,0.0733,1,0.07528],["CHEK2","CHK2 kinase","relays DNA damage alarms","N",0,-0.1628,0.1531,0.0404,1,0.01934],["MRE11","MRE11 nuclease","grabs DNA breaks","N",0,-0.1333,0.238,0.0446,1,0.00097],["RAD50","RAD50","grabs DNA breaks","N",0,-0.1109,0.2326,0.0526,1,0.0],["NBN","Nibrin","grabs DNA breaks","N",0,-0.0969,0.1725,0.0517,1,0.01867],["H2AX","Histone H2AX","flags DNA breaks","N",0,-0.1274,0.2086,0.086,1,0.01452],["MDC1","MDC1","gathers repair proteins","N",0,-0.1311,0.2696,0.1169,1,0.01582],["RNF8","RNF8 ubiquitin ligase","marks DNA breaks","N",0,-0.0465,0.1169,0.0641,1,0.00791],["RNF168","RNF168 ubiquitin ligase","marks DNA breaks","N",0,-0.0821,0.2403,0.1522,1,0.0],["PARP1","PARP1","spots single-strand DNA breaks","N",0,0.0523,0.2138,0.0272,0,0.04979],["XRCC1","XRCC1","scaffold for DNA repair","N",0,0.0334,0.1089,0.0173,0,0.05065],["LIG3","DNA ligase 3","seals repaired DNA","N",0,0.0814,0.294,0.0302,0,0.0],["POLB","DNA polymerase beta","fills DNA gaps","N",0,0.048,0.1962,0.033,0,0.0],["MLH1","MLH1","fixes copying mistakes","N",0,0.0795,0.248,-0.0195,0,0.00791],["PMS2","PMS2","fixes copying mistakes","N",0,0.0374,0.1262,-0.0165,0,0.0],["MSH2","MSH2","spots copying mistakes","N",0,0.0452,0.1285,-0.0007,0,0.01575],["MSH6","MSH6","spots copying mistakes","N",0,0.0867,0.2261,0.0201,0,0.02353],["FANCD2","FANCD2","repairs DNA cross-links","N",0,-0.1576,0.0811,-0.0033,1,0.00973],["FANCI","FANCI","repairs DNA cross-links","N",0,-0.1891,0.0853,-0.0178,1,0.0],["ATR","ATR kinase","senses stalled DNA copying","N",1,-0.2939,0.1266,0.0247,1,0.05812],["CHEK1","CHK1 kinase","pauses the cell cycle","N",1,-0.0977,0.0475,0.0217,1,0.15237],["ATRIP","ATRIP","partner of ATR","N",0,-0.248,0.0841,0.0134,1,0.0404],["CDK1","CDK1 kinase","starts cell division","N",1,0.1332,0.1953,0.0512,0,0.10174],["PLK1","Polo-like kinase 1","drives mitosis","N",1,-0.202,0.0945,0.106,1,0.0172],["CDC20","CDC20","triggers chromosome separation","N",1,0.2145,0.2207,0.0192,0,0.06964],["ANAPC1","APC/C subunit 1","cell-cycle ubiquitin ligase","N",1,0.2368,0.2236,-0.0056,0,6e-05],["ANAPC2","APC/C subunit 2","cell-cycle ubiquitin ligase","N",1,0.2019,0.1832,0.0116,0,0.01568],["ANAPC4","APC/C subunit 4","cell-cycle ubiquitin ligase","N",1,0.2358,0.2368,-0.0171,0,6e-05],["ANAPC11","APC/C subunit 11","cell-cycle ubiquitin ligase","N",1,0.1653,0.1337,0.0115,0,0.0],["CDC27","APC/C subunit CDC27","cell-cycle ubiquitin ligase","N",1,0.2387,0.2391,-0.0014,0,0.01568],["WEE1","WEE1 kinase","brakes cell division","N",1,0.0639,0.0854,0.0277,0,0.0],["AURKA","Aurora kinase A","builds the spindle","N",1,-0.1477,0.0581,0.0908,1,0.0],["CCNA2","Cyclin A2","partner of CDK1 and CDK2","N",1,0.051,0.0998,0.0288,0,0.08676],["CDK2","CDK2 kinase","starts DNA copying","N",0,0.1125,0.2866,0.1028,0,0.05507],["CDK4","CDK4 kinase","moves cells past G1","N",0,0.0825,0.0588,-0.1238,2,0.05713],["CDK6","CDK6 kinase","moves cells past G1","N",0,0.1248,0.0726,-0.1666,2,4e-05],["CCNB1","Cyclin B1","partner of CDK1","N",0,0.1601,0.1931,0.0355,0,0.07623],["CCNE1","Cyclin E1","partner of CDK2","N",0,0.0673,0.2114,0.0823,0,0.01806],["CCND1","Cyclin D1","partner of CDK4 and CDK6","N",0,0.0668,0.0512,-0.0987,2,0.01002],["CDKN1A","p21","brakes the cell cycle","N",0,0.1033,0.2786,0.0863,0,0.11624],["CDKN1B","p27","brakes the cell cycle","N",0,0.0274,0.092,0.0366,0,0.00782],["CDKN2A","p16 / ARF","brakes the cell cycle","N",0,0.1644,0.1138,-0.222,2,0.00373],["RB1","Retinoblastoma protein","gatekeeper of cell division","N",0,0.1269,0.1005,-0.1708,2,0.01982],["E2F1","E2F1","switches on S-phase genes","N",0,0.1429,0.0845,-0.1541,2,0.00791],["TFDP1","DP1","partner of E2F1","N",0,0.0787,0.0378,-0.0743,2,0.0],["CDC25A","CDC25A phosphatase","activates CDKs","N",0,-0.1251,0.0839,0.0285,1,0.0242],["CDC25C","CDC25C phosphatase","activates CDK1","N",0,-0.1736,0.0763,0.0636,1,0.09284],["FZR1","CDH1 (FZR1)","APC/C activator","N",0,0.2532,0.2262,-0.0074,0,0.0],["MAD2L1","MAD2","spindle checkpoint","N",0,0.2391,0.2275,0.0039,0,0.00791],["MAD1L1","MAD1","spindle checkpoint","N",0,0.2289,0.2052,-0.0143,0,0.0],["BUB1B","BUBR1","spindle checkpoint","N",0,0.0707,0.0769,0.0083,0,0.0],["CUL1","Cullin 1","ubiquitin ligase scaffold","C",1,0.0375,0.6472,0.2531,0,0.00791],["SKP1","SKP1","ubiquitin ligase adaptor","C",1,0.1073,0.7637,0.311,0,0.027],["RBX1","RBX1","ubiquitin ligase core","C",1,0.0011,0.5852,0.2233,0,0.0],["FBXW7","FBXW7","tags MYC and cyclin E for destruction","C",0,0.1695,0.7654,0.3446,0,0.02112],["SKP2","SKP2","tags p27 for destruction","C",0,0.1192,0.5632,0.2279,0,0.00487],["BTRC","beta-TrCP","tags beta-catenin and IkB","C",0,0.0503,0.5351,0.2072,0,0.02813],["HSP90AA1","HSP90 chaperone","folds signalling proteins","C",0,0.3234,0.2891,-0.5403,2,0.16973],["CDC37","CDC37","HSP90 partner for kinases","C",0,0.3653,0.2575,-0.612,2,0.0],["EGFR","EGF receptor","growth-factor receptor","M",0,0.0565,0.0606,0.9815,3,0.0245],["ERBB2","HER2","growth-factor receptor","M",0,0.153,0.0711,0.9705,3,0.04314],["ERBB3","HER3","growth-factor receptor","M",0,0.2347,0.0941,0.952,3,0.00642],["INSR","Insulin receptor","senses insulin","M",0,0.0946,0.3706,0.9077,3,0.00791],["IGF1R","IGF-1 receptor","senses growth factor IGF-1","M",0,0.086,0.3242,0.9261,3,0.0],["HRAS","HRAS","growth signal switch","M",0,0.3987,0.2652,0.8608,3,0.00549],["KRAS","KRAS","growth signal switch","M",0,0.3891,0.3075,0.8511,3,0.00654],["NRAS","NRAS","growth signal switch","M",0,0.3527,0.3464,0.852,3,0.00059],["CDH1","E-cadherin","glues cells together","M",0,-0.7305,0.2692,-0.6035,4,0.0],["LRP6","LRP6","Wnt co-receptor","M",0,-0.8526,0.3081,-0.3851,4,0.0],["TGFBR1","TGF-beta receptor 1","senses TGF-beta","M",0,0.1875,0.3403,-0.9051,2,0.02359],["TGFBR2","TGF-beta receptor 2","senses TGF-beta","M",0,0.1075,0.2956,-0.9334,2,0.00791],["TNFRSF1A","TNF receptor 1","senses TNF","M",0,0.5003,-0.5092,0.6787,8,0.00791],["LRP1","LRP1","clears lipoproteins and amyloid","M",0,-0.7083,-0.1931,-0.6567,4,0.0],["APP","Amyloid precursor protein","source of amyloid-beta","M",0,-0.7414,-0.1137,-0.6385,4,0.0314],["PSEN1","Presenilin 1","gamma-secretase core","M",0,-0.8091,0.0311,-0.5608,4,0.06961],["PSEN2","Presenilin 2","gamma-secretase core","M",0,-0.856,-0.1067,-0.4754,4,0.0],["NCSTN","Nicastrin","gamma-secretase subunit","M",0,-0.8311,-0.0608,-0.5251,4,0.00394],["APH1A","APH-1A","gamma-secretase subunit","M",0,-0.8483,-0.0404,-0.499,4,0.00394],["PSENEN","PEN-2","gamma-secretase subunit","M",0,-0.7667,0.0088,-0.6184,4,0.0],["BACE1","BACE1 (beta-secretase)","cuts APP into amyloid","M",0,-0.6805,-0.118,-0.7023,4,0.0],["GRB2","GRB2 adaptor","links receptors to RAS","C",0,0.1131,0.1224,0.7457,3,0.05263],["SOS1","SOS1","switches RAS on","C",0,0.2566,0.219,0.7728,3,0.00426],["SHC1","SHC1 adaptor","links receptors to GRB2","C",0,0.0562,0.0975,0.8162,3,0.0],["RAF1","RAF1 kinase","relays RAS signals","C",0,0.3554,0.2842,0.6528,3,0.07439],["BRAF","BRAF kinase","relays RAS signals","C",0,0.2538,0.2411,0.4826,3,0.01505],["MAP2K1","MEK1","relays to ERK","C",0,0.3474,0.3455,0.5803,3,0.02301],["MAP2K2","MEK2","relays to ERK","C",0,0.2866,0.3062,0.4698,3,0.00044],["MAPK1","ERK2","growth signal kinase","C",0,0.2691,0.2967,0.4018,3,0.00395],["MAPK3","ERK1","growth signal kinase","C",0,0.3138,0.3828,0.5169,3,0.00395],["PIK3CA","PI3K catalytic alpha","makes the PIP3 signal","C",0,0.2351,0.1474,0.5864,3,0.00087],["PIK3R1","PI3K regulatory p85","docks PI3K on receptors","C",0,0.1579,0.1187,0.5801,3,0.00104],["PTEN","PTEN phosphatase","erases the PIP3 signal","C",0,0.2417,0.3356,-0.3839,2,0.0],["AKT1","AKT1 kinase","survival and growth kinase","C",0,-0.0302,-0.2517,-0.4436,7,0.144],["PDPK1","PDK1 kinase","activates AKT","C",0,-0.056,-0.3664,-0.7521,7,0.0],["MTOR","mTOR kinase","growth controller","C",0,-0.1102,-0.3026,-0.4809,7,0.05041],["RPTOR","Raptor","mTORC1 subunit","C",0,-0.1722,-0.3186,-0.473,7,0.01576],["RICTOR","Rictor","mTORC2 subunit","C",0,-0.1518,-0.3011,-0.5472,7,0.0],["MLST8","mLST8","mTOR subunit","C",0,-0.1621,-0.3122,-0.5156,7,5e-05],["TSC1","Hamartin (TSC1)","brake on mTOR","C",0,-0.0045,-0.3538,-0.4332,7,0.0],["TSC2","Tuberin (TSC2)","brake on mTOR","C",0,-0.0401,-0.474,-0.673,7,0.01173],["RHEB","RHEB","switches mTOR on","C",0,-0.0824,-0.3832,-0.5454,7,0.00022],["RPS6KB1","S6 kinase 1","boosts protein synthesis","C",0,-0.1854,-0.4296,-0.6042,7,0.0],["EIF4EBP1","4E-BP1","holds back protein synthesis","C",0,-0.3118,-0.4501,-0.6294,7,0.00791],["EIF4E","eIF4E","starts protein synthesis","C",0,-0.2362,-0.2951,-0.3921,7,0.0],["IRS1","Insulin receptor substrate 1","relays insulin signals","C",0,0.0999,0.1777,0.6272,3,0.02474],["SRC","SRC kinase","signalling kinase","C",0,0.016,-0.0175,0.7427,3,0.00346],["PTPN11","SHP2 phosphatase","boosts RAS signals","C",0,0.0487,0.1462,0.7537,3,0.0],["CBL","CBL ubiquitin ligase","switches receptors off","C",0,0.0737,0.0528,0.6801,3,0.0],["STAT3","STAT3","signal-driven gene switch","C",0,-0.0349,0.0229,0.5857,3,0.02906],["JAK2","JAK2 kinase","cytokine receptor kinase","C",0,-0.0835,0.0165,0.5901,3,0.0],["ABL1","ABL1 kinase","signalling kinase, target of imatinib","C",0,-0.3996,0.5948,0.1791,1,0.01824],["GSK3B","GSK3-beta kinase","brake in Wnt and insulin signalling","C",0,-0.642,0.1081,-0.3585,4,0.05973],["CTNNB1","beta-catenin","Wnt signal and cell glue","C",0,-0.4852,0.1223,-0.3401,4,0.14042],["APC","APC","destroys beta-catenin","C",0,-0.6123,0.2143,-0.393,4,0.0],["AXIN1","Axin 1","scaffold that destroys beta-catenin","C",0,-0.5354,0.1654,-0.2981,4,0.01666],["CSNK1A1","Casein kinase 1 alpha","primes beta-catenin for destruction","C",0,-0.5141,0.1437,-0.314,4,0.0],["DVL1","Dishevelled 1","relays Wnt signals","C",0,-0.4526,0.1914,-0.234,4,0.0],["CTNNA1","alpha-catenin","links cell junctions to actin","C",0,-0.603,0.2353,-0.4532,4,0.0],["TCF7L2","TCF7L2 (TCF4)","Wnt-driven gene switch","N",0,-0.2479,0.0583,-0.2087,4,0.0],["LEF1","LEF1","Wnt-driven gene switch","N",0,-0.0901,0.028,-0.0778,4,0.0],["TGFB1","TGF-beta 1","signal that restrains growth","X",0,0.0621,0.2992,-1.0864,2,0.0],["SMAD2","SMAD2","carries TGF-beta signals","C",0,0.185,0.3194,-0.7514,2,6e-05],["SMAD3","SMAD3","carries TGF-beta signals","C",0,0.2023,0.2991,-0.6127,2,0.04655],["SMAD4","SMAD4","partner of SMAD2/3","C",0,0.1334,0.1934,-0.4691,2,0.0],["SMAD7","SMAD7","blocks TGF-beta signalling","C",0,0.0837,0.1466,-0.4845,2,0.0],["TNF","Tumour necrosis factor","inflammation signal","X",0,0.5319,-0.5513,0.8497,8,0.0],["APOE","Apolipoprotein E","carries lipids in the brain","X",0,-0.7922,-0.1993,-0.7856,4,0.0],["INS","Insulin","hormone that lowers blood sugar","X",0,0.069,0.5183,1.0112,3,0.0],["TRADD","TRADD","TNF receptor adaptor","C",0,0.2867,-0.2817,0.3111,8,0.01983],["TRAF2","TRAF2","TNF receptor adaptor","C",0,0.4877,-0.4079,0.4917,8,0.0],["RIPK1","RIPK1 kinase","decides survive or die","C",0,0.4831,-0.3565,0.439,8,0.01708],["CHUK","IKK-alpha","NF-kB activating kinase","C",0,0.5472,-0.2605,0.3714,8,0.0],["IKBKB","IKK-beta","NF-kB activating kinase","C",0,0.3973,-0.1809,0.2934,8,0.03747],["IKBKG","NEMO","IKK regulator","C",0,0.3884,-0.218,0.3014,8,0.02375],["NFKBIA","IkB-alpha","holds NF-kB in the cytoplasm","C",0,0.1731,0.4716,-0.6361,2,0.04507],["RELA","NF-kB p65","inflammation gene switch","C",0,0.1842,0.3496,-0.5198,2,0.04469],["NFKB1","NF-kB p50","inflammation gene switch","C",0,0.1586,0.4338,-0.627,2,0.0],["FADD","FADD","death-receptor adaptor","C",0,0.2979,-0.3825,0.3231,8,0.01795],["CASP8","Caspase 8","starts cell death","C",0,0.3736,-0.6061,0.3946,8,0.06931],["CASP9","Caspase 9","starts cell death","C",0,0.3061,-0.6553,0.2455,8,0.01575],["CASP3","Caspase 3","executes cell death","C",0,0.3399,-0.6816,0.336,8,0.0389],["APAF1","APAF1","builds the apoptosome","C",0,0.2191,-0.4528,0.1216,8,0.00791],["CYCS","Cytochrome c","released to trigger cell death","C",0,0.2344,-0.4659,0.0892,8,0.0],["BCL2","BCL-2","blocks cell death","C",0,0.0748,-0.1932,-0.4695,7,0.02112],["BCL2L1","BCL-XL","blocks cell death","C",0,0.0917,-0.2784,-0.7828,7,0.08649],["MCL1","MCL-1","blocks cell death","C",0,0.1509,-0.1811,-0.6787,7,0.00046],["BAX","BAX","punches holes in mitochondria","C",0,0.1028,-0.2036,-0.5539,7,0.06089],["BAK1","BAK","punches holes in mitochondria","C",0,0.0962,-0.1677,-0.6105,7,0.00696],["BID","BID","links caspase-8 to mitochondria","C",0,0.1243,-0.1918,-0.5609,7,0.07451],["BAD","BAD","sensitises cells to death","C",0,0.0459,-0.3511,-0.7716,7,0.02823],["XIAP","XIAP","blocks caspases","C",0,0.2492,-0.62,0.263,8,0.00791],["DIABLO","SMAC","releases the caspase brake","C",0,0.1875,-0.6019,0.2424,8,0.0],["MAPT","Tau","stabilises microtubules in neurons","C",0,-0.7652,0.1124,-0.2934,4,0.01575],["CDK5","CDK5 kinase","neuronal kinase","C",0,-0.5881,0.0789,-0.1516,4,0.00791],["CDK5R1","p35","activates CDK5","C",0,-0.6423,0.0815,-0.1118,4,0.0],["APBB1","Fe65","binds the tail of APP","C",0,-0.4273,-0.1142,-0.3524,4,0.0]],"edges":[[0,1],[0,6],[0,7],[0,14],[1,2],[1,8],[1,15],[2,3],[2,9],[2,16],[2,137],[2,86],[3,4],[3,10],[3,17],[4,5],[4,11],[4,18],[5,6],[5,12],[5,19],[6,13],[7,8],[7,13],[8,9],[9,10],[10,11],[11,12],[12,13],[14,15],[14,18],[14,21],[15,19],[15,21],[16,19],[16,17],[17,18],[17,20],[20,21],[22,23],[22,24],[22,26],[22,27],[22,29],[22,32],[22,25],[22,28],[22,34],[22,35],[22,37],[23,24],[23,30],[23,31],[23,33],[24,31],[24,32],[25,28],[26,29],[27,29],[34,35],[34,36],[37,38],[37,41],[37,47],[38,39],[38,40],[39,40],[41,42],[41,43],[41,47],[41,85],[41,86],[41,91],[41,206],[41,210],[41,220],[41,233],[42,47],[42,46],[42,85],[42,210],[42,220],[42,233],[43,44],[43,152],[45,185],[45,186],[46,47],[47,91],[47,155],[47,203],[47,136],[48,85],[49,85],[50,80],[50,78],[51,55],[51,54],[51,57],[51,71],[52,56],[52,54],[52,58],[53,55],[53,56],[54,57],[55,72],[56,119],[57,61],[58,59],[58,60],[58,61],[59,60],[59,61],[60,61],[62,74],[62,75],[62,63],[62,64],[62,137],[62,114],[62,108],[62,130],[62,72],[65,68],[65,66],[65,71],[66,67],[67,69],[67,70],[68,69],[71,72],[71,130],[72,73],[76,77],[76,78],[76,83],[76,91],[76,98],[77,78],[78,79],[78,80],[78,81],[80,121],[81,82],[83,84],[85,86],[85,87],[85,88],[85,91],[85,98],[85,99],[85,118],[85,89],[85,90],[85,155],[85,107],[85,242],[85,189],[85,140],[86,87],[86,88],[86,139],[86,140],[86,190],[89,103],[91,92],[91,94],[91,95],[91,96],[91,97],[91,98],[91,99],[93,94],[93,95],[93,115],[96,100],[98,99],[98,102],[98,103],[98,208],[99,143],[100,101],[100,102],[101,102],[102,104],[103,104],[104,105],[105,106],[107,108],[108,109],[108,110],[111,112],[111,113],[113,114],[115,116],[115,117],[117,118],[117,119],[118,143],[118,144],[120,134],[120,130],[120,144],[120,128],[121,144],[121,129],[122,127],[122,124],[122,134],[122,146],[122,148],[123,124],[123,125],[124,126],[125,127],[127,145],[130,131],[131,135],[131,137],[131,138],[131,143],[132,136],[132,139],[132,140],[132,137],[132,156],[132,155],[133,136],[133,139],[135,137],[135,138],[135,152],[136,140],[138,153],[140,141],[141,142],[146,147],[149,150],[149,151],[150,152],[150,153],[150,154],[154,210],[154,232],[155,156],[155,190],[155,158],[155,181],[157,178],[157,180],[157,158],[157,203],[157,205],[157,206],[158,159],[158,178],[159,188],[160,202],[160,161],[160,225],[161,202],[162,179],[162,181],[162,187],[163,179],[163,181],[163,182],[163,187],[164,179],[164,182],[165,210],[166,212],[167,168],[167,219],[167,220],[167,222],[168,218],[169,223],[169,226],[170,171],[170,224],[171,172],[171,177],[171,224],[171,253],[172,210],[172,209],[172,174],[172,175],[172,176],[173,174],[173,175],[174,175],[178,180],[178,179],[178,202],[178,204],[178,205],[178,208],[181,182],[181,183],[182,183],[182,184],[183,185],[183,186],[184,185],[184,186],[187,188],[188,202],[190,191],[190,197],[190,192],[190,209],[190,247],[192,198],[192,193],[192,194],[192,195],[192,199],[193,195],[193,199],[193,200],[194,195],[196,197],[197,198],[200,201],[206,207],[209,212],[209,210],[209,250],[210,211],[210,212],[210,213],[210,216],[210,217],[210,215],[211,212],[212,213],[212,214],[219,221],[219,220],[220,221],[226,227],[226,228],[226,235],[227,228],[228,231],[229,231],[229,230],[230,231],[230,232],[232,233],[232,234],[233,234],[235,236],[236,246],[236,238],[237,238],[237,239],[237,248],[238,248],[239,240],[241,244],[241,247],[241,246],[242,244],[242,245],[242,247],[243,245],[243,246],[244,246],[248,249],[250,251],[251,252]],"disease":{"breast":["BRCA1","BRCA2","PALB2","TP53","PTEN","CHEK2","ATM","CDH1","PIK3CA","ERBB2","ESR1","BARD1","BRIP1","RAD51","AKT1","CCND1"],"alzheimer":["APP","PSEN1","PSEN2","APOE","MAPT","BACE1"]},"stats":{"avg":6.57,"diam":17,"pair":["ORC6","TNF"],"q":0.8,"nComm":10,"hist":[0.01167,0.03062,0.06013,0.10326,0.14765,0.16134,0.15141,0.11783,0.0859,0.06097,0.03934,0.01861,0.007,0.00293,0.00106,0.00022,6e-05]}};
const HOP_DIST = [0.01167, 0.03062, 0.06013, 0.10326, 0.14765, 0.16134, 0.15141, 0.11783, 0.0859, 0.06097, 0.03934, 0.01861, 0.007, 0.00293, 0.00106, 0.00022, 6e-05];

const D2R = Math.PI / 180;
const LIFT = 0.0015;
// Narration timing: [time in your recording, original story cue]. The story's
// animation is stretched or squeezed between these points so each cue lands
// on the matching sentence. Edit here if you re-record.
const NARRATION_SYNC = [
  [0, 0], [212, 212],
];
// recording time -> original story time
function storyT(t) {
  const W = NARRATION_SYNC;
  if (t <= 0) return 0;
  for (let i = 1; i < W.length; i++) {
    if (t <= W[i][0]) { const [n0, o0] = W[i - 1], [n1, o1] = W[i]; return o0 + (o1 - o0) * (t - n0) / (n1 - n0); }
  }
  return W[W.length - 1][1] + (t - W[W.length - 1][0]);
}
// original story time -> recording time
function narrT(o) {
  const W = NARRATION_SYNC;
  for (let i = 1; i < W.length; i++) {
    if (o <= W[i][1]) { const [n0, o0] = W[i - 1], [n1, o1] = W[i]; return n0 + (n1 - n0) * (o - o0) / (o1 - o0); }
  }
  return W[W.length - 1][0] + (o - W[W.length - 1][1]);
}
let T_END = NARRATION_SYNC[NARRATION_SYNC.length - 1][0];
const CH = [
  { key: 'title', name: 'Intro', a: 0, b: 12 },
  { key: 'nodes', name: 'Proteins', a: 12, b: 28 },
  { key: 'edges', name: 'Interactions', a: 28, b: 48 },
  { key: 'degree', name: 'Hubs', a: 48, b: 70 },
  { key: 'essential', name: 'Essential', a: 70, b: 90 },
  { key: 'communities', name: 'Modules', a: 90, b: 114 },
  { key: 'disease', name: 'Disease modules', a: 114, b: 140 },
  { key: 'paths', name: 'Drug targets', a: 140, b: 168 },
  { key: 'robustness', name: 'Robustness', a: 168, b: 198 },
  { key: 'outro', name: 'Recap', a: 198, b: 212 },
];
CH.forEach(c => { c.na = narrT(c.a); c.nb = narrT(c.b); }); // chapter times on the recording's clock
const C = Object.fromEntries(CH.map(c => [c.key, c]));
const COMM_NAMES = ['Cell cycle & DNA copying', 'DNA break repair', 'p53 & gene control', 'Growth-factor signalling',
  'Wnt & amyloid', 'Proteasome', 'DNA replication start', 'AKT-mTOR & survival', 'TNF & cell death', 'RNA polymerase II'];
const COMM_COLORS = [[1.00, 0.42, 0.22], [0.30, 0.58, 1.00], [1.00, 0.84, 0.18], [0.25, 0.90, 0.45],
  [0.80, 0.38, 1.00], [0.15, 0.92, 0.92], [1.00, 0.38, 0.68], [0.62, 1.00, 0.25], [1.00, 0.70, 0.52],
  [0.92, 0.94, 1.00]];
const INTER_COLOR = [0.36, 0.42, 0.56];
// Pre-computed with NetworkX on this network
const STATS = { avgHops: 6.57, diameter: 17, diamPair: ["ORC6", "TNF"], q: 0.8, nComm: 10 };

const $ = s => document.querySelector(s);
const smooth = x => (x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x));
const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);
const fmt = n => Math.round(n).toLocaleString('en-US');
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const css = name => getComputedStyle(document.documentElement).getPropertyValue(name).trim();

// ------------------------------------------------------------------ data --
function bytes(b64) {
  const s = atob(b64), u = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) u[i] = s.charCodeAt(i);
  return u;
}
const NET = (() => {
  const nodes = PPI.nodes, N = nodes.length, E = PPI.edges.length;
  const COMP = { X: 'outside the cell', M: 'cell membrane', C: 'cytoplasm', N: 'nucleus' };
  const lat = new Float32Array(N), lon = new Float32Array(N), deg = new Int32Array(N), R = new Float32Array(N);
  const btw = new Float64Array(N), comm = new Int32Array(N), ess = new Uint8Array(N);
  const code = [], city = [], country = [], name = [];
  const P = new Float32Array(N * 3);  // unit direction of each protein from the cell centre
  nodes.forEach((n, i) => {
    const [sym, nm, role, cp, es, x, y, z, cm, b] = n, r = Math.hypot(x, y, z);
    code.push(sym); name.push(nm); city.push(role); country.push(COMP[cp]);
    ess[i] = es; comm[i] = cm; btw[i] = b; R[i] = r;
    P[3 * i] = x / r; P[3 * i + 1] = y / r; P[3 * i + 2] = z / r;
    lat[i] = Math.asin(y / r) / D2R; lon[i] = Math.atan2(-z / r, x / r) / D2R;
  });
  const eu = new Int32Array(E), ev = new Int32Array(E);
  PPI.edges.forEach(([a, b], e) => { eu[e] = a; ev[e] = b; deg[a]++; deg[b]++; });
  const cnt = new Int32Array(N + 1);
  for (let e = 0; e < E; e++) { cnt[eu[e] + 1]++; cnt[ev[e] + 1]++; }
  for (let i = 0; i < N; i++) cnt[i + 1] += cnt[i];
  const adjS = cnt.slice(), adj = new Int32Array(2 * E), fill = cnt.slice(0, N);
  for (let e = 0; e < E; e++) { adj[fill[eu[e]]++] = ev[e]; adj[fill[ev[e]]++] = eu[e]; }
  const rankOf = key => {
    const ord = Array.from({ length: N }, (_, i) => i).sort((a, b) => key[b] - key[a] || a - b);
    const r = new Int32Array(N);
    ord.forEach((i, k) => { r[i] = k + 1; });
    return { ord, r };
  };
  const dR = rankOf(deg), bR = rankOf(btw);
  const index = new Map();
  code.forEach((c, i) => index.set(c, i));
  const maxDeg = Math.max(...deg), maxBtw = Math.max(...btw);
  // knockouts in the story: 20 random proteins, and the 20 most central in 4 waves of 5
  const wave = new Int32Array(N);
  bR.ord.slice(0, 20).forEach((i, k) => { wave[i] = Math.floor(k / 5) + 1; });
  const rnd = permutation(5, N).slice(0, 20), rndFlag = new Uint8Array(N);
  rnd.forEach(i => { rndFlag[i] = 1; });
  return { N, E, lat, lon, deg, btw, comm, eu, ev, rnd, rndFlag, wave, code, city, country, name, adjS, adj, ess, R,
    degOrd: dR.ord, degRank: dR.r, btwOrd: bR.ord, btwRank: bR.r, index, maxDeg, maxBtw, P };
})();
const A = i => NET.index.get(i);

function decodeRings(b64) {
  const u8 = bytes(b64), dv = new DataView(u8.buffer);
  const n = dv.getUint32(0, true);
  let o = 4;
  const lens = [];
  for (let i = 0; i < n; i++, o += 2) lens.push(dv.getUint16(o, true));
  return lens.map(L => {
    const r = new Float32Array(2 * L);
    let x = 0, y = 0;
    for (let k = 0; k < L; k++, o += 4) {
      x += dv.getInt16(o, true); y += dv.getInt16(o + 2, true);
      r[2 * k] = x / 50; r[2 * k + 1] = y / 50;
    }
    return r;
  });
}

// ----------------------------------------------------------- graph maths --
function bfs(s, removed) {
  const { N, adjS, adj } = NET;
  const dist = new Int16Array(N).fill(-1), order = new Int32Array(N);
  let h = 0, t = 0;
  if (removed && removed[s]) return { dist, order, n: 0 };
  dist[s] = 0; order[t++] = s;
  while (h < t) {
    const u = order[h++];
    for (let k = adjS[u]; k < adjS[u + 1]; k++) {
      const v = adj[k];
      if (dist[v] < 0 && !(removed && removed[v])) { dist[v] = dist[u] + 1; order[t++] = v; }
    }
  }
  return { dist, order, n: t };
}
// Shortest path; among equally short ones prefer bigger (more recognisable) hubs.
function bestPath(s, t, removed) {
  const { adjS, adj, deg } = NET;
  const { dist, order, n } = bfs(s, removed);
  if (dist[t] < 0) return null;
  const score = new Float64Array(NET.N).fill(-Infinity), prev = new Int32Array(NET.N).fill(-1);
  const sigma = new Float64Array(NET.N);
  score[s] = 0; sigma[s] = 1;
  for (let q = 1; q < n; q++) {
    const v = order[q], d = dist[v];
    if (d > dist[t]) break;
    let best = -Infinity, bp = -1;
    for (let k = adjS[v]; k < adjS[v + 1]; k++) {
      const u = adj[k];
      if (dist[u] === d - 1 && (!removed || !removed[u])) {
        sigma[v] += sigma[u];
        const sc = score[u] + (u === s ? 0 : Math.log(deg[u]));
        if (sc > best) { best = sc; bp = u; }
      }
    }
    score[v] = best; prev[v] = bp;
  }
  const path = [t];
  while (path[path.length - 1] !== s) path.push(prev[path[path.length - 1]]);
  return { path: path.reverse(), count: sigma[t] };
}
function connectivity(removed) {
  const { N, E, eu, ev } = NET;
  const parent = new Int32Array(N), size = new Int32Array(N).fill(1);
  for (let i = 0; i < N; i++) parent[i] = i;
  const find = x => { while (parent[x] !== x) { parent[x] = parent[parent[x]]; x = parent[x]; } return x; };
  let lost = 0;
  for (let e = 0; e < E; e++) {
    const u = eu[e], v = ev[e];
    if (removed[u] || removed[v]) { lost++; continue; }
    let a = find(u), b = find(v);
    if (a === b) continue;
    if (size[a] < size[b]) [a, b] = [b, a];
    parent[b] = a; size[a] += size[b];
  }
  let pairs = 0, big = 0;
  for (let i = 0; i < N; i++) {
    if (!removed[i] && parent[i] === i) { pairs += size[i] * (size[i] - 1); if (size[i] > big) big = size[i]; }
  }
  return { pairs: pairs / (N * (N - 1)), lcc: big / N, lost };
}
function mulberry(seed) {
  return () => {
    seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function permutation(seed, n) {
  const r = mulberry(seed), p = Array.from({ length: n || (typeof NET !== 'undefined' ? NET.N : PPI.nodes.length) }, (_, i) => i);
  for (let i = p.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [p[i], p[j]] = [p[j], p[i]]; }
  return p;
}
function nodePos(i, h, out) {
  const r = NET.R[i] + (h || 0);
  out.set(NET.P[3 * i] * r, NET.P[3 * i + 1] * r, NET.P[3 * i + 2] * r);
  return out;
}
function km(a, b) {
  const { lat, lon } = NET;
  const la1 = lat[a] * D2R, la2 = lat[b] * D2R, dl = (lon[b] - lon[a]) * D2R;
  const c = Math.sin(la1) * Math.sin(la2) + Math.cos(la1) * Math.cos(la2) * Math.cos(dl);
  return 6371 * Math.acos(clamp(c, -1, 1));
}

// -------------------------------------------------------------- geometry --
const arcHeight = th => 0.006 + 0.075 * Math.pow(th / Math.PI, 0.85);
function arcPoints(u, v, segDeg, lift = 0) {
  const P = NET.P;
  const ax = P[3 * u], ay = P[3 * u + 1], az = P[3 * u + 2], bx = P[3 * v], by = P[3 * v + 1], bz = P[3 * v + 2];
  const th = Math.acos(clamp(ax * bx + ay * by + az * bz, -1, 1)), sn = Math.sin(th), h = arcHeight(th);
  const n = Math.min(64, Math.floor(th / D2R / segDeg) + 4);
  const out = new Float32Array((n + 1) * 3);
  for (let k = 0; k <= n; k++) {
    const s = k / n;
    const w1 = sn < 1e-6 ? 1 - s : Math.sin((1 - s) * th) / sn, w2 = sn < 1e-6 ? s : Math.sin(s * th) / sn;
    const x = w1 * ax + w2 * bx, y = w1 * ay + w2 * by, z = w1 * az + w2 * bz;
    const r = (NET.R[u] * (1 - s) + NET.R[v] * s + lift + 0.45 * h * Math.sin(Math.PI * s)) / Math.hypot(x, y, z);
    out[3 * k] = x * r; out[3 * k + 1] = y * r; out[3 * k + 2] = z * r;
  }
  return out;
}
function tubeGeometry(pairs, radius, hops, seed) {
  // 8 sides so thick tubes look round; lifted by their radius so they don't sink into the globe at airports
  const sides = 8, rng = mulberry(seed || 1);
  const arcs = pairs.map(([u, v]) => arcPoints(u, v, 2.0, radius));
  // stepped paths get a round joint at every stop, shown once the flight reaches it
  const SJ = 10, SK = 6, joints = [];
  if (hops) {
    joints.push([pairs[0][0], hops[0], 0]);
    pairs.forEach(([, v], e) => joints.push([v, hops[e], 1]));
  }
  let nv = 0, ni = 0;
  for (const a of arcs) { const m = a.length / 3; nv += m * sides; ni += (m - 1) * sides * 6; }
  nv += joints.length * (SK + 1) * (SJ + 1); ni += joints.length * SK * SJ * 6;
  const pos = new Float32Array(nv * 3), aT = new Float32Array(nv), aHop = new Float32Array(nv), aRv = new Float32Array(nv);
  const idx = new Uint32Array(ni);
  let vo = 0, io = 0;
  const T = new THREE.Vector3(), U = new THREE.Vector3(), B = new THREE.Vector3(), N2 = new THREE.Vector3();
  arcs.forEach((a, e) => {
    const m = a.length / 3, rv = rng(), hop = hops ? hops[e] : 1, base = vo;
    for (let k = 0; k < m; k++) {
      const k0 = Math.max(0, k - 1), k1 = Math.min(m - 1, k + 1);
      T.set(a[3 * k1] - a[3 * k0], a[3 * k1 + 1] - a[3 * k0 + 1], a[3 * k1 + 2] - a[3 * k0 + 2]).normalize();
      U.set(a[3 * k], a[3 * k + 1], a[3 * k + 2]).normalize();
      B.crossVectors(T, U).normalize(); N2.crossVectors(B, T);
      for (let j = 0; j < sides; j++) {
        const ang = 2 * Math.PI * j / sides, c = Math.cos(ang) * radius, s = Math.sin(ang) * radius;
        pos[3 * vo] = a[3 * k] + c * B.x + s * N2.x; pos[3 * vo + 1] = a[3 * k + 1] + c * B.y + s * N2.y;
        pos[3 * vo + 2] = a[3 * k + 2] + c * B.z + s * N2.z;
        aT[vo] = k / (m - 1); aHop[vo] = hop; aRv[vo] = rv; vo++;
      }
    }
    for (let k = 0; k < m - 1; k++) for (let j = 0; j < sides; j++) {
      const a0 = base + k * sides + j, a1 = base + k * sides + (j + 1) % sides;
      idx[io++] = a0; idx[io++] = a1; idx[io++] = a1 + sides; idx[io++] = a0; idx[io++] = a1 + sides; idx[io++] = a0 + sides;
    }
  });
  const P = NET.P, jr = radius * 1.12;
  for (const [i, hop, t] of joints) {
    const jl = NET.R[i] + radius, cx = P[3 * i] * jl, cy = P[3 * i + 1] * jl, cz = P[3 * i + 2] * jl, base = vo;
    for (let a = 0; a <= SK; a++) {
      const th = Math.PI * a / SK;
      for (let b = 0; b <= SJ; b++) {
        const ph = 2 * Math.PI * b / SJ;
        pos[3 * vo] = cx + jr * Math.sin(th) * Math.cos(ph); pos[3 * vo + 1] = cy + jr * Math.cos(th); pos[3 * vo + 2] = cz + jr * Math.sin(th) * Math.sin(ph);
        aT[vo] = t; aHop[vo] = hop; aRv[vo] = 0; vo++;
      }
    }
    for (let a = 0; a < SK; a++) for (let b = 0; b < SJ; b++) {
      const q0 = base + a * (SJ + 1) + b, q1 = q0 + SJ + 1;
      idx[io++] = q0; idx[io++] = q1; idx[io++] = q0 + 1; idx[io++] = q0 + 1; idx[io++] = q1; idx[io++] = q1 + 1;
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('aT', new THREE.BufferAttribute(aT, 1));
  g.setAttribute('aHop', new THREE.BufferAttribute(aHop, 1));
  g.setAttribute('aRv', new THREE.BufferAttribute(aRv, 1));
  g.setIndex(new THREE.BufferAttribute(idx, 1));
  return g;
}

// ----------------------------------------------------------------- shaders --
const GLSL_COMMON = `
uniform vec3 uPal[11];
vec3 degRamp(float x) {
  vec3 c0 = vec3(0.12, 0.34, 1.0), c1 = vec3(0.16, 0.86, 1.0), c2 = vec3(1.0, 0.72, 0.18), c3 = vec3(1.0, 0.42, 0.12);
  if (x < 0.45) return mix(c0, c1, x / 0.45);
  if (x < 0.78) return mix(c1, c2, (x - 0.45) / 0.33);
  return mix(c2, c3, (x - 0.78) / 0.22);
}
vec3 btwRamp(float x) {
  vec3 c0 = vec3(0.10, 0.42, 0.38), c1 = vec3(0.22, 0.95, 0.52), c2 = vec3(0.92, 1.0, 0.95);
  if (x < 0.45) return mix(c0, c1, x / 0.45);
  return mix(c1, c2, (x - 0.45) / 0.55);
}
float removal(float rnd, float wave, float xrm, float uRnd, float uTgt, float uX) {
  float r = max(rnd * uRnd, step(0.5, wave) * clamp(uTgt - wave + 1.0, 0.0, 1.0));
  return max(r, xrm * uX);
}`;
const AIRPORT_UNIFORMS = `
uniform float uReveal, uWDeg, uWBtw, uWComm, uFocus, uPathProg, uRndRm, uTgtRm, uXrm, uDegH, uBtwH, uIso, uSel, uAlpha;`;
const AIRPORT_COLOR = `
  vec3 col = vec3(0.80, 0.90, 1.0);
  col = mix(col, degRamp(aDeg), uWDeg);
  col = mix(col, btwRamp(aBtw), uWBtw);
  col = mix(col, uPal[int(aComm + 0.5)], uWComm);
  float onPath = step(0.5, aPath);
  float reached = onPath * clamp((uPathProg - aPath + 1.35) / 0.35, 0.0, 1.0);
  col = mix(col, vec3(1.0, 0.36, 0.86), uFocus * reached);
  float bright = mix(1.0, 0.22 + reached * 1.5, uFocus);
  float r = removal(aRnd, aWave, aXrm, uRndRm, uTgtRm, uXrm);
  float red = clamp(r / 0.35, 0.0, 1.0);
  float gone = smoothstep(0.45, 1.0, r);
  col = mix(col, vec3(1.0, 0.24, 0.17), red);
  float iso = uIso < -0.5 ? 1.0 : (abs(aComm - uIso) < 0.5 ? 1.0 : 0.10);
  float sel = 1.0 - step(0.5, abs(aIdx - uSel));`;

function airportMaterial(uniforms) {
  return new THREE.ShaderMaterial({
    uniforms, transparent: true, depthWrite: false,
    vertexShader: GLSL_COMMON + AIRPORT_UNIFORMS + `
attribute float aIdx, aRand, aDeg, aBtw, aComm, aRnd, aWave, aPath, aHDeg, aHBtw, aSize, aXrm;
uniform float uScale, uPx;
varying vec3 vCol; varying float vA, vRing;
void main() {
  float h = aHDeg * uDegH + aHBtw * uBtwH;
  vec4 mv = modelViewMatrix * vec4(position + normalize(position) * h, 1.0);
  gl_Position = projectionMatrix * mv;
  ${AIRPORT_COLOR}
  float reveal = clamp((uReveal * 1.12 - aRand) / 0.12, 0.0, 1.0);
  vCol = col * bright; vRing = sel;
  vA = reveal * (1.0 - gone * 0.82) * iso * uAlpha;
  // in a headset (uPx > 0) dots keep their size relative to the globe as you move
  float att = uPx > 0.0 ? uPx * projectionMatrix[1][1] / max(-mv.z, 0.05) : 1.0;
  gl_PointSize = max(aSize * uScale * att * (1.0 + sel * 1.2) * (1.0 + 0.7 * uFocus * reached), uPx > 0.0 ? 1.6 : 0.0);
}`,
    fragmentShader: `
varying vec3 vCol; varying float vA, vRing;
void main() {
  vec2 c = gl_PointCoord - 0.5; float d = length(c);
  if (d > 0.5) discard;
  float core = smoothstep(0.5, 0.30, d);
  float ring = vRing * smoothstep(0.5, 0.44, d) * (1.0 - smoothstep(0.38, 0.30, d));
  gl_FragColor = vec4(vCol + vec3(0.5, 0.9, 1.0) * ring * 1.5, vA * max(core, ring));
}`,
  });
}
function pillarMaterial(uniforms) {
  return new THREE.ShaderMaterial({
    uniforms, transparent: true,
    vertexShader: GLSL_COMMON + AIRPORT_UNIFORMS + `
attribute vec3 aPos;
attribute float aIdx, aDeg, aBtw, aComm, aRnd, aWave, aPath, aHDeg, aHBtw, aW, aXrm;
varying vec3 vCol; varying float vA, vTop;
void main() {
  float h = aHDeg * uDegH + aHBtw * uBtwH;
  vec3 up = normalize(aPos);
  vec3 e1 = normalize(cross(abs(up.y) < 0.99 ? vec3(0.0, 1.0, 0.0) : vec3(1.0, 0.0, 0.0), up));
  vec3 e2 = cross(up, e1);
  vec3 p = aPos + e1 * position.x * aW + e2 * position.z * aW + up * position.y * h;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
  ${AIRPORT_COLOR}
  vCol = col * bright; vTop = position.y;
  vA = step(0.0008, h) * (1.0 - gone * 0.9) * iso * uAlpha;
}`,
    fragmentShader: `
varying vec3 vCol; varying float vA, vTop;
void main() { gl_FragColor = vec4(vCol * (0.35 + 0.95 * pow(vTop, 1.5)), vA * 0.95); }`,
  });
}
function routeMaterial(uniforms) {
  return new THREE.ShaderMaterial({
    uniforms, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    vertexShader: GLSL_COMMON + `
attribute float aT, aRv, aComm, aRnd, aWave, aXrm;
uniform float uReveal, uAlpha, uWComm, uRndRm, uTgtRm, uXrm, uIso;
uniform vec3 uBase;
varying vec3 vCol; varying float vA;
void main() {
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  float g = clamp((uReveal - aRv * 0.75) / 0.25, 0.0, 1.0);
  // nothing until this route's reveal has begun (otherwise each route's first point shows as a streak)
  float vis = step(0.0001, g) * step(aT, g + 0.0005);
  float inter = step(9.5, aComm);
  vec3 col = mix(uBase, uPal[int(aComm + 0.5)], uWComm);
  float ca = mix(1.0, mix(1.0, 0.22, inter), uWComm);
  float r = removal(aRnd, aWave, aXrm, uRndRm, uTgtRm, uXrm);
  col = mix(col, vec3(1.0, 0.22, 0.14), clamp(r / 0.35, 0.0, 1.0));
  float iso = uIso < -0.5 ? 1.0 : (abs(aComm - uIso) < 0.5 ? 1.0 : 0.04);
  vCol = col;
  vA = vis * uAlpha * ca * (1.0 - smoothstep(0.45, 1.0, r)) * iso;
}`,
    fragmentShader: `
varying vec3 vCol; varying float vA;
void main() { gl_FragColor = vec4(vCol, vA); }`,
  });
}
function highlightMaterial(color, stepped, spread) {
  return new THREE.ShaderMaterial({
    side: THREE.DoubleSide, // the inside shows through open tube ends instead of a hollow cut
    uniforms: { uProg: { value: 0 }, uAlpha: { value: 0 }, uColor: { value: new THREE.Color(...color) },
      uStepped: { value: stepped ? 1 : 0 }, uSpread: { value: spread || 0 } },
    transparent: true, depthWrite: false,
    vertexShader: `
attribute float aT, aHop, aRv;
uniform float uProg, uStepped, uSpread;
varying float vT, vG;
void main() {
  vT = aT;
  vG = uStepped > 0.5 ? clamp(uProg - aHop + 1.0, 0.0, 1.0) : clamp((uProg - aRv * uSpread) / (1.0 - uSpread), 0.0, 1.0);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`,
    fragmentShader: `
uniform float uAlpha; uniform vec3 uColor;
varying float vT, vG;
void main() {
  if (vT > vG + 0.0005) discard;
  float head = (1.0 - smoothstep(0.0, 0.05, vG - vT)) * step(vG, 0.999);
  gl_FragColor = vec4(uColor * (1.0 + head * 1.4), uAlpha);
}`,
  });
}
function globeMaterial(tex) {
  return new THREE.ShaderMaterial({
    uniforms: { uMask: { value: tex }, uL: { value: new THREE.Vector3(0, 0, 1) } },
    extensions: { derivatives: true },
    vertexShader: `
varying vec2 vUv; varying vec3 vN, vW;
void main() {
  vUv = uv; vN = normalize((modelMatrix * vec4(normal, 0.0)).xyz);
  vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz;
  gl_Position = projectionMatrix * viewMatrix * w;
}`,
    fragmentShader: `
uniform sampler2D uMask; uniform vec3 uL;
varying vec2 vUv; varying vec3 vN, vW;
float grid(float x, float stp) {
  float f = abs(fract(x / stp + 0.5) - 0.5) * stp;
  return 1.0 - smoothstep(0.0, fwidth(x) * 1.2 + 0.04, f);
}
void main() {
  float m = texture2D(uMask, vUv).r;
  float mb = texture2D(uMask, vUv, 2.5).r;
  float land = smoothstep(0.3, 0.7, m);
  float coast = 1.0 - smoothstep(0.0, 0.26, abs(mb - 0.5));
  vec3 n = normalize(vN), v = normalize(cameraPosition - vW);
  float dif = max(dot(n, uL), 0.0);
  float spec = pow(max(dot(n, normalize(uL + v)), 0.0), 70.0) * (1.0 - land) * 0.22;
  vec3 base = mix(vec3(0.020, 0.058, 0.115), vec3(0.110, 0.170, 0.230), land);
  float lon = vUv.x * 360.0, lat = vUv.y * 180.0 - 90.0;
  float g = max(grid(lon, 30.0) * (1.0 - smoothstep(70.0, 86.0, abs(lat))), grid(lat, 30.0));
  vec3 col = base * (0.30 + 0.95 * dif) + vec3(spec) + vec3(0.16, 0.55, 0.75) * coast * 0.42 * (0.45 + 0.55 * dif);
  col += vec3(0.30, 0.55, 0.85) * g * 0.07;
  col += vec3(0.20, 0.45, 1.0) * pow(1.0 - max(dot(n, v), 0.0), 3.0) * 0.08;
  gl_FragColor = vec4(col, 1.0);
}`,
  });
}
function atmosphereMaterial() {
  return new THREE.ShaderMaterial({
    side: THREE.BackSide, transparent: true, depthWrite: false, depthTest: false, blending: THREE.AdditiveBlending,
    uniforms: { uCenter: { value: new THREE.Vector3() }, uRadius: { value: 1 } },
    vertexShader: `varying vec3 vW; void main() { vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`,
    // globe centre and radius are uniforms so the glow still fits when the globe is moved and scaled;
    // the glow goes in alpha (same additive result) so passthrough AR is not covered by black
    fragmentShader: `
uniform vec3 uCenter; uniform float uRadius;
varying vec3 vW;
void main() {
  vec3 d = normalize(vW - cameraPosition);
  float b = length(cross(cameraPosition - uCenter, d)) / uRadius;
  float glow = pow(smoothstep(0.955, 1.0, b) * (1.0 - smoothstep(1.0, 1.045, b)), 2.0);
  gl_FragColor = vec4(vec3(0.24, 0.52, 1.0), glow * 0.55);
}`,
  });
}

// ------------------------------------------------------------------- scene --
const GL = {};
function buildScene(canvas) {
  const renderer = HOST.makeRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
  renderer.xr.enabled = true;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(32, 1, 0.01, 200);
  Object.assign(GL, { renderer, scene, camera, canvas });
  // the globe and everything on it live in GL.world, so the headset view can move and scale it
  GL.rig = new THREE.Group(); GL.world = new THREE.Group();
  scene.add(GL.rig); GL.rig.add(GL.world);
  const { N, E, P, deg, btw, comm, eu, ev, rndFlag, wave, maxDeg, maxBtw } = NET;

  // the cell: a see-through membrane with the nucleus inside
  const shell = (rgb, a0, a1) => new THREE.ShaderMaterial({
    uniforms: { uL: { value: new THREE.Vector3(0, 0, 1) } },
    transparent: true, depthWrite: false, side: THREE.DoubleSide,
    vertexShader: `varying vec3 vN, vW; void main() { vN = normalize((modelMatrix * vec4(normal, 0.0)).xyz); vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`,
    fragmentShader: `uniform vec3 uL; varying vec3 vN, vW;
void main() {
  vec3 n = normalize(vN), v = normalize(cameraPosition - vW);
  float rim = pow(1.0 - abs(dot(n, v)), 2.5);
  float lit = 0.75 + 0.25 * max(dot(n, uL), 0.0);
  gl_FragColor = vec4(vec3(${rgb}) * lit, ${a0} + ${a1} * rim);
}`,
  });
  GL.globeMat = shell('0.35, 0.75, 0.95', 0.025, 0.42);
  const membrane = new THREE.Mesh(new THREE.SphereGeometry(1, 128, 80), GL.globeMat);
  membrane.renderOrder = 1;
  GL.world.add(membrane);
  const nucleus = new THREE.Mesh(new THREE.SphereGeometry(0.37, 96, 64), shell('0.75, 0.55, 1.0', 0.05, 0.5));
  nucleus.renderOrder = 1;
  GL.world.add(nucleus);
  GL.atmMat = atmosphereMaterial(); // kept for the shared code; the cell has no halo
  const atm = new THREE.Mesh(new THREE.SphereGeometry(1.055, 8, 6), GL.atmMat);
  atm.visible = false;
  GL.world.add(atm);

  // stars
  const sr = mulberry(9), sp = new Float32Array(1800 * 3), sc = new Float32Array(1800 * 3);
  for (let i = 0; i < 1800; i++) {
    const z = sr() * 2 - 1, t = sr() * Math.PI * 2, r = Math.sqrt(1 - z * z), b = 0.25 + 0.75 * Math.pow(sr(), 3);
    sp.set([60 * r * Math.cos(t), 60 * z, 60 * r * Math.sin(t)], 3 * i); sc.set([b, b, b * 1.05], 3 * i);
  }
  const sg = new THREE.BufferGeometry();
  sg.setAttribute('position', new THREE.BufferAttribute(sp, 3)); sg.setAttribute('color', new THREE.BufferAttribute(sc, 3));
  GL.stars = new THREE.Points(sg, new THREE.PointsMaterial({ size: 1.3, sizeAttenuation: false, vertexColors: true }));
  scene.add(GL.stars);

  // shared uniforms for airports and pillars
  const pal = COMM_COLORS.concat([INTER_COLOR]).map(c => new THREE.Vector3(...c));
  const U = {};
  for (const k of ['uReveal', 'uWDeg', 'uWBtw', 'uWComm', 'uFocus', 'uPathProg', 'uRndRm', 'uTgtRm', 'uXrm', 'uDegH', 'uBtwH'])
    U[k] = { value: 0 };
  Object.assign(U, { uIso: { value: -1 }, uSel: { value: -1 }, uAlpha: { value: 1 }, uScale: { value: 1 }, uPx: { value: 0 }, uPal: { value: pal } });
  GL.U = U;

  // per-airport attributes
  const rng = mulberry(1);
  const at = {
    aIdx: new Float32Array(N), aRand: new Float32Array(N), aDeg: new Float32Array(N), aBtw: new Float32Array(N),
    aComm: new Float32Array(N), aRnd: new Float32Array(N), aWave: new Float32Array(N), aPath: new Float32Array(N),
    aHDeg: new Float32Array(N), aHBtw: new Float32Array(N), aSize: new Float32Array(N), aXrm: new Float32Array(N),
  };
  const lmax = Math.log1p(maxDeg);
  for (let i = 0; i < N; i++) {
    at.aIdx[i] = i; at.aRand[i] = rng(); at.aDeg[i] = Math.log1p(deg[i]) / lmax; at.aBtw[i] = Math.sqrt(btw[i] / maxBtw);
    at.aComm[i] = comm[i]; at.aRnd[i] = rndFlag[i]; at.aWave[i] = wave[i];
    at.aHDeg[i] = 0.32 * deg[i] / maxDeg; at.aHBtw[i] = 0.32 * btw[i] / maxBtw;
    at.aSize[i] = 2.0 + 6.0 * Math.sqrt(deg[i] / maxDeg);
  }
  GL.attr = at;
  const pg = new THREE.BufferGeometry();
  const pp = new Float32Array(N * 3);
  for (let i = 0; i < N; i++) for (let k = 0; k < 3; k++) pp[3 * i + k] = P[3 * i + k] * NET.R[i];
  pg.setAttribute('position', new THREE.BufferAttribute(pp, 3));
  for (const [k, v] of Object.entries(at)) pg.setAttribute(k, new THREE.BufferAttribute(v, 1));
  GL.dots = new THREE.Points(pg, airportMaterial(U));
  GL.dots.renderOrder = 3;
  GL.world.add(GL.dots);

  // pillars: instanced open hexagonal prisms, height from uniforms
  const cyl = new THREE.CylinderGeometry(1, 1, 1, 6, 1, true);
  cyl.translate(0, 0.5, 0);
  const ig = new THREE.InstancedBufferGeometry();
  ig.index = cyl.index; ig.setAttribute('position', cyl.attributes.position);
  ig.setAttribute('aPos', new THREE.InstancedBufferAttribute(pp, 3));
  const aW = new Float32Array(N);
  for (let i = 0; i < N; i++) aW[i] = 0.0016 + 0.0034 * Math.sqrt(deg[i] / maxDeg);
  ig.setAttribute('aW', new THREE.InstancedBufferAttribute(aW, 1));
  for (const k of ['aIdx', 'aDeg', 'aBtw', 'aComm', 'aRnd', 'aWave', 'aPath', 'aHDeg', 'aHBtw', 'aXrm'])
    ig.setAttribute(k, new THREE.InstancedBufferAttribute(at[k], 1));
  ig.instanceCount = N;
  GL.pillars = new THREE.Mesh(ig, pillarMaterial(U));
  GL.pillars.frustumCulled = false;
  GL.pillars.renderOrder = 2;
  GL.world.add(GL.pillars);

  // all 18,858 routes as one line set
  let tot = 0, segs = 0;
  const arcs = new Array(E);
  for (let e = 0; e < E; e++) { arcs[e] = arcPoints(eu[e], ev[e], 4); const m = arcs[e].length / 3; tot += m; segs += m - 1; }
  const rp = new Float32Array(tot * 3), aT = new Float32Array(tot), aRv = new Float32Array(tot), aC = new Float32Array(tot);
  const aR = new Float32Array(tot), aWv = new Float32Array(tot), edgeOf = new Int32Array(tot), ri = new Uint32Array(segs * 2);
  const er = mulberry(3);
  let o = 0, io = 0;
  for (let e = 0; e < E; e++) {
    const a = arcs[e], m = a.length / 3, u = eu[e], v = ev[e], rv = er();
    const c = comm[u] === comm[v] ? comm[u] : 10, rf = Math.max(rndFlag[u], rndFlag[v]);
    const wu = wave[u], wv = wave[v], wv2 = wu > 0 && wv > 0 ? Math.min(wu, wv) : Math.max(wu, wv);
    rp.set(a, o * 3);
    for (let k = 0; k < m; k++) {
      aT[o + k] = k / (m - 1); aRv[o + k] = rv; aC[o + k] = c; aR[o + k] = rf; aWv[o + k] = wv2; edgeOf[o + k] = e;
      if (k < m - 1) { ri[io++] = o + k; ri[io++] = o + k + 1; }
    }
    o += m;
  }
  const rg = new THREE.BufferGeometry();
  rg.setAttribute('position', new THREE.BufferAttribute(rp, 3));
  rg.setAttribute('aT', new THREE.BufferAttribute(aT, 1)); rg.setAttribute('aRv', new THREE.BufferAttribute(aRv, 1));
  rg.setAttribute('aComm', new THREE.BufferAttribute(aC, 1)); rg.setAttribute('aRnd', new THREE.BufferAttribute(aR, 1));
  rg.setAttribute('aWave', new THREE.BufferAttribute(aWv, 1));
  rg.setAttribute('aXrm', new THREE.BufferAttribute(new Float32Array(tot), 1));
  rg.setIndex(new THREE.BufferAttribute(ri, 1));
  GL.routeEdgeOf = edgeOf;
  GL.RU = { uReveal: { value: 0 }, uAlpha: { value: 0 }, uWComm: { value: 0 }, uRndRm: { value: 0 }, uTgtRm: { value: 0 },
    uXrm: { value: 0 }, uIso: { value: -1 }, uBase: { value: new THREE.Vector3(0.38, 0.66, 1.0) }, uPal: { value: pal } };
  GL.routes = new THREE.LineSegments(rg, routeMaterial(GL.RU));
  GL.routes.renderOrder = 4;
  GL.world.add(GL.routes);
  GL.highlights = {};
}
// a bright overlay of routes (example edge, path, a hub's fan, a selection)
function setHighlight(key, pairs, color, opts = {}) {
  const old = GL.highlights[key];
  if (old) { GL.world.remove(old); old.geometry.dispose(); old.material.dispose(); delete GL.highlights[key]; }
  if (!pairs || !pairs.length) return null;
  const mesh = new THREE.Mesh(tubeGeometry(pairs, (opts.radius || 0.002) * (GL.hlScale || 1), opts.hops, opts.seed),
    highlightMaterial(color, !!opts.hops, opts.spread));
  mesh.renderOrder = 6;
  mesh.userData.args = [pairs, color, opts];
  GL.world.add(mesh);
  GL.highlights[key] = mesh;
  return mesh;
}
// explore-mode closures: flag airports and the routes that touch them
function setClosedAttributes(removed) {
  const ax = GL.attr.aXrm;
  for (let i = 0; i < NET.N; i++) ax[i] = removed[i] ? 1 : 0;
  GL.dots.geometry.attributes.aXrm.needsUpdate = true;
  GL.pillars.geometry.attributes.aXrm.needsUpdate = true;
  const ra = GL.routes.geometry.attributes.aXrm, eo = GL.routeEdgeOf, { eu, ev } = NET;
  for (let k = 0; k < eo.length; k++) { const e = eo[k]; ra.array[k] = removed[eu[e]] || removed[ev[e]] ? 1 : 0; }
  ra.needsUpdate = true;
}
function setPathAttribute(path) {
  const a = GL.attr.aPath;
  a.fill(0);
  if (path) path.forEach((i, k) => { a[i] = k + 1; });
  GL.dots.geometry.attributes.aPath.needsUpdate = true;
  GL.pillars.geometry.attributes.aPath.needsUpdate = true;
}

// lights up a whole set of proteins at once (all at the first path step)
function setFocusSet(list) {
  const a = GL.attr.aPath;
  a.fill(0);
  list.forEach(i => { a[i] = 1; });
  GL.dots.geometry.attributes.aPath.needsUpdate = true;
  GL.pillars.geometry.attributes.aPath.needsUpdate = true;
}

// ------------------------------------------------------------------ camera --
function cameraPose(lat, lon, dist, tilt, heading) {
  const la = lat * D2R, lo = lon * D2R, ti = tilt * D2R, he = heading * D2R;
  const U = new THREE.Vector3(Math.cos(la) * Math.cos(lo), Math.sin(la), -Math.cos(la) * Math.sin(lo));
  const Nn = new THREE.Vector3(-Math.sin(la) * Math.cos(lo), Math.cos(la), Math.sin(la) * Math.sin(lo));
  const E = new THREE.Vector3(-Math.sin(lo), 0, -Math.cos(lo));
  const hint = Nn.multiplyScalar(Math.cos(he)).add(E.multiplyScalar(Math.sin(he)));
  const T = U.clone();
  const Cp = T.clone().addScaledVector(U, Math.cos(ti) * dist).addScaledVector(hint, -Math.sin(ti) * dist);
  const F = T.clone().sub(Cp).normalize();
  const up = hint.clone().addScaledVector(F, -hint.dot(F)).normalize();
  return { C: Cp, T, up };
}
function applyCamera(p) {
  const fit = GL.fit || 1;
  const { C, T, up } = cameraPose(p[0], p[1], (p[2] + 1) * fit - 1, p[3], p[4]);
  GL.camera.position.copy(C); GL.camera.up.copy(up); GL.camera.lookAt(T);
}
function resize() {
  if (GL.renderer.xr.isPresenting) return;
  const w = window.innerWidth, h = window.innerHeight, { renderer, camera } = GL;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  const wide = w >= 900;
  GL.wide = wide;
  if (wide) camera.setViewOffset(w, h, -0.14 * w, 0, w, h);
  else camera.setViewOffset(w, h, 0, 0.21 * h, w, h);
  GL.fit = wide ? Math.max(1, 1.55 / (w / h)) : Math.max(1.15, 1.5 / (w / h) * 0.62);
  camera.updateProjectionMatrix();
}


// ================================================================== STORY ==
const DEF = { ex2_prog: 0, ex2_alpha: 1, node_reveal: 0, route_reveal: 0, route_alpha: 1, ex_prog: 0, ex_alpha: 1, ams_prog: 0, ams_alpha: 1,
  anc_prog: 0, anc_alpha: 1, path_prog: 0, path_alpha: 1, path_focus: 0, w_deg: 0, w_btw: 0, w_comm: 0,
  deg_h: 0, btw_h: 0, rnd_rm: 0, tgt_rm: 0, xrm: 0 };
const TR = {};
const key = (n, t, v) => { (TR[n] = TR[n] || []).push([t, v]); };
const ramp = (n, t0, t1, v0, v1) => { key(n, t0, v0); key(n, t1, v1); };
function evalTrack(n, t) {
  const ks = TR[n];
  if (!ks) return DEF[n];
  if (t <= ks[0][0]) return ks[0][1];
  for (let i = 1; i < ks.length; i++) {
    if (t <= ks[i][0]) {
      const [t0, v0] = ks[i - 1], [t1, v1] = ks[i];
      return t1 <= t0 ? v1 : v0 + (v1 - v0) * smooth((t - t0) / (t1 - t0));
    }
  }
  return ks[ks.length - 1][1];
}
function storyState(t) {
  const s = {};
  for (const n in DEF) s[n] = evalTrack(n, t);
  return s;
}
const fadeVal = (t, a, b, d) => (t <= a || t >= b ? 0 : Math.min(smooth((t - a) / d), smooth((b - t) / d)));

const ST = { labels: [], items: [], hopEnds: [], cam: [] };

function buildStory() {
  const { deg, code, city, N, E } = NET;
  const tp53 = A('TP53'), mdm2 = A('MDM2'), ctnnb1 = A('CTNNB1'), parp1 = A('PARP1'), bace1 = A('BACE1');
  const all = Array.from({ length: N }, (_, i) => i);
  const top10 = NET.degOrd.slice(0, 10), inTop = new Set(top10);
  let touch = 0;
  for (let e = 0; e < E; e++) if (inTop.has(NET.eu[e]) || inTop.has(NET.ev[e])) touch++;
  const small = all.filter(i => deg[i] <= 2).length;
  // essential proteins: mean number of partners, computed live
  const essL = all.filter(i => NET.ess[i]), othL = all.filter(i => !NET.ess[i]);
  const mean = l => l.reduce((s, i) => s + deg[i], 0) / l.length;
  const mEss = mean(essL), mOth = mean(othL);
  ST.ess = essL;
  // disease module: largest connected group of breast-cancer genes vs random sets of the same size
  const breast = PPI.disease.breast.map(A).filter(i => i !== undefined);
  const lccOf = set => {
    const inS = new Set(set), seen = new Set(); let best = 0;
    for (const s0 of set) {
      if (seen.has(s0)) continue;
      let n = 0; const st = [s0]; seen.add(s0);
      while (st.length) { const u = st.pop(); n++; for (let k = NET.adjS[u]; k < NET.adjS[u + 1]; k++) { const v = NET.adj[k]; if (inS.has(v) && !seen.has(v)) { seen.add(v); st.push(v); } } }
      best = Math.max(best, n);
    }
    return best;
  };
  const lcc = lccOf(breast);
  const rng = mulberry(11);
  let rs = 0; const TRIALS = 500;
  for (let t = 0; t < TRIALS; t++) {
    const pick = new Set(); while (pick.size < breast.length) pick.add(Math.floor(rng() * N));
    rs += lccOf([...pick]);
  }
  const rndLcc = rs / TRIALS;
  ST.breast = breast;
  // drug targets: distance to the breast-cancer module
  const inB = new Set(breast);
  const distTo = s => { const { dist } = bfs(s); return Math.min(...breast.map(b => dist[b])); };
  const dParp = distTo(parp1);
  let near = -1, nd = 1e9;
  { const { dist } = bfs(bace1); breast.forEach(b => { if (dist[b] >= 0 && dist[b] < nd) { nd = dist[b]; near = b; } }); }
  const sp = near >= 0 ? bestPath(bace1, near) : null;
  const path = sp ? sp.path : null;
  ST.path = path;
  const L = path ? path.length - 1 : 0;
  const parpLink = NET.adj.slice(NET.adjS[parp1], NET.adjS[parp1 + 1]).find(j => inB.has(j));

  // robustness, computed live
  const none = new Uint8Array(N);
  const base = connectivity(none).pairs, rnd = connectivity(NET.rndFlag).pairs;
  const tg = [5, 10, 15, 20].map(k => { const m = new Uint8Array(N); NET.btwOrd.slice(0, k).forEach(i => { m[i] = 1; }); return connectivity(m).pairs; });
  ST.rob = { base, rnd, tg };

  // ------------------------------------------------------------ panel copy
  const bins = [[1, 1], [2, 2], [3, 3], [4, 4], [5, 6], [7, 9], [10, 14], [15, 99]];
  const counts = bins.map(([lo, hi]) => Array.from(deg).filter(d => d >= lo && d <= hi).length);
  const mx = Math.max(...counts), lmax = Math.log1p(NET.maxDeg);
  const degColor = x => { const c = x < 0.45 ? [[0.12, 0.34, 1], [0.16, 0.86, 1], x / 0.45] : x < 0.78 ? [[0.16, 0.86, 1], [1, 0.72, 0.18], (x - 0.45) / 0.33] : [[1, 0.72, 0.18], [1, 0.42, 0.12], (x - 0.78) / 0.22];
    return 'rgb(' + c[0].map((v, k) => Math.round(255 * (v + (c[1][k] - v) * c[2]))).join(',') + ')'; };
  const degBars = bins.map(([lo, hi], k) => `<div class="bar"><span class="v">${fmt(counts[k])}</span>
    <div class="fill" data-grow="${3.2 + 0.24 * k}" style="height:${(100 * counts[k] / mx).toFixed(1)}%;background:${degColor(Math.log1p(Math.sqrt(lo * Math.min(hi, NET.maxDeg))) / lmax)}"></div>
    <span class="k">${lo === hi ? lo : k === bins.length - 1 ? lo + '+' : lo + '–' + hi}</span></div>`).join('');
  const legend = COMM_NAMES.map((n, k) => `<li data-at="${4.8 + 0.24 * k}"><span class="sw" style="background:rgb(${COMM_COLORS[k].map(v => Math.round(v * 255)).join(',')})"></span>${n}</li>`).join('');
  const pct = x => Math.round(x * 100);
  const more = mEss > mOth + 0.05 ? 'more' : 'about as many';
  const html = {
    title: `<svg class="route-mark" viewBox="0 0 360 44" aria-hidden="true"><path id="titleArc" d="M8 36 Q180 -16 352 36" fill="none" stroke="var(--magenta)" stroke-width="2.2" stroke-linecap="round" pathLength="1" stroke-dasharray="1" stroke-dashoffset="1"/><circle cx="8" cy="36" r="4.5" fill="var(--magenta)"/><circle cx="352" cy="36" r="4.5" fill="var(--magenta)" id="titleDot" opacity="0"/></svg>
      <h1 data-at="1.2">Network medicine</h1>
      <p class="lede" data-at="2.4">told with the proteins in a human cell</p>
      <p data-at="3.6">${fmt(N)} proteins and ${fmt(E)} interactions, placed where they work in the cell. Eight ideas about how health and disease play out on the molecular network, then the network is yours to explore.</p>`,
    nodes: `<h2 data-at="0.6">Proteins are nodes</h2>
      <p data-at="1.2">Every dot is a protein, one of the roughly 20,000 our genes encode. This map shows ${fmt(N)} well-studied ones, each placed where it mainly works: on the cell membrane, in the cytoplasm, or inside the nucleus, the inner sphere.</p>
      <p data-at="8">Proteins are nodes just like airports: the same rules of network theory apply.</p>`,
    edges: `<h2 data-at="0.6">Interactions are edges</h2>
      <p data-at="1.2">When two proteins physically bind, they share an edge. MDM2 binds the tumour suppressor p53 and marks it for destruction, keeping it in check.</p>
      <p data-at="10">All together, ${fmt(E)} interactions tie these proteins into one network.</p>
      <p class="note" data-at="15">Every interaction here was measured in experiments. Even so, maps like this are incomplete: many human protein interactions are still unknown.</p>`,
    degree: `<h2 data-at="0.6">Hubs</h2>
      <p data-at="1.2">Most proteins bind only a few partners, while a few hubs bind many. p53 has ${deg[tp53]} partners in this map, beta-catenin ${deg[ctnnb1]}.</p>
      <p class="caption" data-at="3">Proteins by number of partners</p>
      <div class="bars" data-at="3">${degBars}</div>
      <p data-at="8">${fmt(small)} proteins have one or two partners, while the 10 biggest hubs take part in ${pct(touch / E)}% of all interactions. Spike height shows the number of partners.</p>`,
    essential: `<h2 data-at="0.6">Essential proteins</h2>
      <p data-at="1.2">Some proteins are essential: without them, almost no human cell can survive.</p>
      <p data-at="5">${essL.length} proteins in this map are essential (highlighted). They have ${mEss.toFixed(1)} partners on average, the others ${mOth.toFixed(1)}: essential proteins tend to have ${more} partners.</p>
      <p class="note" data-at="11">In yeast, hubs turned out to be more likely essential: the centrality-lethality rule. Many essential proteins work in tight machines such as the proteasome and RNA polymerase.</p>`,
    communities: `<h2 data-at="0.6">Modules</h2>
      <p data-at="1.2">Proteins that work together are densely linked: molecular machines and signalling pathways form modules. The Louvain algorithm found these ten from the interactions alone.</p>
      <ul class="legend">${legend}</ul>`,
    disease: `<h2 data-at="0.6">Disease modules</h2>
      <p data-at="1.2">Genes linked to the same disease are not scattered across the network. Here are the ${breast.length} breast cancer genes in this map.</p>
      <div class="big magenta" data-at="5">${lcc}<small>of ${breast.length} form one connected module</small></div>
      <p data-at="9">Pick ${breast.length} proteins at random and the largest connected group has only ${rndLcc.toFixed(1)} on average. Disease genes cluster in the same neighbourhood: the disease module at the heart of network medicine.</p>`,
    paths: `<h2 data-at="0.6">Drugs and distance</h2>
      <p data-at="1.2">Drugs work by binding target proteins. Network medicine asks how close a drug's targets sit to a disease module.</p>
      <p data-at="4">Tamoxifen and trastuzumab hit ESR1 and HER2, inside the breast cancer module. Olaparib blocks PARP1, ${dParp === 1 ? 'right next to it' : dParp + ' steps away'}.</p>
      <div class="big magenta" data-at="9"><span id="flights">0</span><small id="flightsWord">steps</small></div>
      <p data-at="19">BACE1, a target of drugs tested against Alzheimer's disease, sits ${L} steps away. Drugs whose targets are close to a disease module are more likely to work against it.</p>`,
    robustness: `<h2 data-at="0.6">Robustness</h2>
      <p data-at="1.2">What happens when proteins fail, through mutations or drugs? Track the share of protein pairs that can still reach each other.</p>
      <div class="big" data-at="3.2" id="robPct">${pct(base)}%</div>
      <p class="caption" data-at="3.2">of protein pairs still connected</p>
      <div style="display:grid">
        <p data-at="6" data-out="17" style="grid-area:1/1">Knock out 20 random proteins: ${pct(rnd)}% of pairs still connect. Most proteins have few partners, so random failures often miss the hubs.</p>
        <p data-at="18" style="grid-area:1/1">Now knock out the 20 most central proteins, the ones with the highest betweenness.</p>
      </div>
      <p data-at="27" class="amber">Robust to random failure, fragile when hubs are hit. TP53, the biggest hub here, is also the most frequently mutated gene in human cancer.</p>`,
    outro: `<h2 data-at="0.6">Network medicine</h2>
      <ul class="concepts" data-at="1.4">${CH.slice(1, 9).map(c => `<li>${c.name}</li>`).join('')}</ul>
      <p data-at="2.6">Now it's your turn. Search any protein, trace paths between proteins, isolate modules, or knock out proteins and watch what breaks.</p>
      <p data-at="3.4"><button class="btn primary" id="btnGoExplore" type="button">Explore the network</button></p>
      <p class="credits" data-at="4.2">An illustrative, curated subnetwork of ${fmt(N)} proteins from well-documented interactions and complexes, not the complete human interactome. Essential genes: DepMap common essentials. Statistics computed with NetworkX. Ideas: Barabási, Gulbahce &amp; Loscalzo 2011; Menche et al. 2015; Guney et al. 2016.</p>`,
  };
  const story = $('#story');
  story.innerHTML = CH.map(c => `<section class="ch" data-ch="${c.key}">${html[c.key]}</section>`).join('');
  CH.forEach(c => {
    const sec = story.querySelector(`[data-ch="${c.key}"]`);
    ST.items.push({ sec, ch: c, els: Array.from(sec.querySelectorAll('[data-at]')).map(el => ({
      el, at: c.a + parseFloat(el.dataset.at), out: el.dataset.out ? c.a + parseFloat(el.dataset.out) : c.b - 0.05, o: -1 })),
      grow: Array.from(sec.querySelectorAll('[data-grow]')).map(el => ({ el, at: c.a + parseFloat(el.dataset.grow), s: -1 })) });
  });

  // ------------------------------------------------------------ timeline keys
  let a = C.nodes.a, b;
  ramp('node_reveal', a + 2, a + 10, 0, 1);
  a = C.edges.a;
  ramp('ex_prog', a + 3, a + 6, 0, 1); ramp('ex_alpha', a + 17, a + 19, 1, 0); ramp('route_reveal', a + 8, a + 19, 0, 1);
  label(tp53, '<b>TP53</b>p53', 0, a + 3.2, a + 16, '');
  label(mdm2, '<b>MDM2</b>keeps p53 in check', 0, a + 5.6, a + 16, '');
  a = C.degree.a; b = C.degree.b;
  ramp('route_alpha', a + 1, a + 3, 1, 0.45);
  ramp('ams_prog', a + 2, a + 6, 0, 1); ramp('ams_alpha', a + 12, a + 14, 1, 0);
  ramp('deg_h', a + 6, a + 11, 0, 1); ramp('w_deg', a + 6, a + 9, 0, 1);
  label(tp53, `<b>TP53</b>${deg[tp53]}`, 'deg', a + 3, b - 0.6, 'amb');
  NET.degOrd.filter(i => i !== tp53).slice(0, 5).forEach((i, k) => label(i, `<b>${code[i]}</b>${deg[i]}`, 'deg', a + 11.6 + 0.6 * k, b - 0.6, 'amb'));
  key('deg_h', b - 1.5, 1); key('deg_h', b + 1, 0); ramp('w_deg', b - 1, b + 1, 1, 0);
  // essential proteins glow (focus), the rest dims
  a = C.essential.a; b = C.essential.b;
  ramp('path_focus', a + 4.5, a + 6.5, 0, 1); ramp('path_focus', b - 2, b, 1, 0);
  ['POLR2A', 'PCNA', 'CDK1', 'PSMA3'].forEach((c, k) => label(A(c), `<b>${c}</b>essential, ${deg[A(c)]} partners`, 0, a + 7 + 0.7 * k, b - 1, 'mag'));
  a = C.communities.a; b = C.communities.b;
  ramp('w_comm', a + 2, a + 5, 0, 1); ramp('w_comm', b - 1, b + 1, 1, 0);
  // disease module: breast cancer genes glow, their interactions light up
  a = C.disease.a; b = C.disease.b;
  ramp('path_focus', a + 1.5, a + 3.5, 0, 1); ramp('path_focus', b - 2, b, 1, 0);
  ramp('route_alpha', a + 1, a + 3, 0.45, 0.15); ramp('route_alpha', b - 2, b, 0.15, 0.45);
  ramp('anc_prog', a + 4, a + 8, 0, 1); ramp('anc_alpha', b - 2, b, 1, 0);
  ['BRCA1', 'TP53', 'ESR1', 'ERBB2', 'PTEN'].forEach((c, k) => label(A(c), `<b>${c}</b>breast cancer`, 0, a + 3 + 0.6 * k, b - 1, 'mag'));
  // drug targets: PARP1 next to the module, then the path from BACE1
  a = C.paths.a; b = C.paths.b;
  ramp('path_focus', a + 1, a + 3, 0, 1); ramp('path_focus', b - 2, b, 1, 0); ramp('path_alpha', b - 2, b, 1, 0);
  ramp('route_alpha', a + 1, a + 3, 0.45, 0.12); ramp('route_alpha', b - 2, b, 0.12, 0.6);
  ramp('ex2_prog', a + 4.5, a + 6.5, 0, 1); ramp('ex2_alpha', a + 8, a + 9.5, 1, 0);
  label(parp1, '<b>PARP1</b>target of olaparib', 0, a + 4, a + 9, 'grn');
  ['ESR1', 'ERBB2'].forEach((c, k) => label(A(c), `<b>${c}</b>${c === 'ESR1' ? 'target of tamoxifen' : 'target of trastuzumab'}`, 0, a + 4.6 + 0.6 * k, a + 9, 'grn'));
  if (path) {
    const dur = 8.4 / L, pause = 0.25;
    let t = a + 10;
    key('path_prog', t, 0);
    label(path[0], `<b>${code[path[0]]}</b>${esc(city[path[0]])}`, 0, a + 9.6, b - 1.2, 'mag');
    for (let k = 0; k < L; k++) {
      key('path_prog', t + dur - pause, k + 1);
      ST.hopEnds.push(t + dur - pause);
      label(path[k + 1], `<b>${code[path[k + 1]]}</b>${esc(city[path[k + 1]])}`, 0, t + dur - pause - 0.2, b - 1.2, 'mag');
      t += dur;
    }
  }
  a = C.robustness.a;
  ramp('route_alpha', a + 1, a + 3, 0.6, 0.8);
  ramp('rnd_rm', a + 7.2, a + 10, 0, 1); ramp('rnd_rm', a + 14.8, a + 16.8, 1, 0);
  for (let k = 0; k < 4; k++) ramp('tgt_rm', a + 18.8 + 2 * k, a + 20.4 + 2 * k, k, k + 1);
  ST.robSteps = [[a + 3.2, base, 'cyan'], [a + 10, rnd, rnd > 0.7 ? 'green' : 'amber'], [a + 16.8, base, 'cyan'],
    [a + 20.4, tg[0], 'amber'], [a + 22.4, tg[1], 'amber'], [a + 24.4, tg[2], 'red'], [a + 26.4, tg[3], 'red']];
  a = C.outro.a;
  ramp('tgt_rm', a + 0.8, a + 4.4, 4, 0);
  for (const n in TR) TR[n].sort((x, y) => x[0] - y[0]);

  // which proteins glow when the story focuses on a set
  ST.focusSets = { essential: essL, disease: breast, paths: path };

  // ------------------------------------------------------------ highlights
  setHighlight('ex', [[tp53, mdm2]], [0.85, 0.95, 1.0], { radius: 0.006 });
  setHighlight('ams', NET.adj.slice(NET.adjS[tp53], NET.adjS[tp53 + 1]).reduce((o, j) => (o.push([tp53, j]), o), []),
    [1.0, 0.72, 0.22], { radius: 0.003, spread: 0.5, seed: 5 });
  const bp = [];
  for (let e = 0; e < E; e++) if (inB.has(NET.eu[e]) && inB.has(NET.ev[e])) bp.push([NET.eu[e], NET.ev[e]]);
  setHighlight('anc', bp, [1.0, 0.45, 0.86], { radius: 0.004, spread: 0.6, seed: 6 });
  if (parpLink !== undefined) setHighlight('ex2', [[parp1, parpLink]], [0.30, 1.0, 0.58], { radius: 0.006 });
  if (path) setHighlight('path', path.slice(0, -1).map((p, k) => [p, path[k + 1]]), [1.0, 0.35, 0.86],
    { radius: 0.006, hops: path.slice(0, -1).map((_, k) => k + 1) });

  // ------------------------------------------------------------ camera: orbit the cell, lean in on the action
  const ll = v => [Math.asin(clamp(v[1], -1, 1)) / D2R, Math.atan2(-v[2], v[0]) / D2R];
  const pv = i => [NET.P[3 * i], NET.P[3 * i + 1], NET.P[3 * i + 2]];
  const dirOf = list => { const c = [0, 0, 0]; list.forEach(i => pv(i).forEach((x, k) => { c[k] += x; })); const n = Math.hypot(...c) || 1; return ll(c.map(x => x / n)); };
  const at = (t, list, d, tilt) => { const [la, lo] = dirOf(list); return [t, clamp(la, -60, 60), lo, d, tilt || 0, 0]; };
  // slow turn past a focus: shift the longitude, keep 'east' unwrapping so the sweep goes the short way
  const spinAround = (w, dLon, ease) => [w[0], w[1], w[2] + dLon, w[3], w[4], w[5], ease && 'east', ease];
  const wp = [[0, 18, 20, 3.4, 0, 0], [C.nodes.a, 14, 60, 3.0, 0, 0], [C.nodes.b - 2, 10, 140, 3.0, 0, 0],
    at(C.edges.a + 3, [tp53, mdm2], 2.1), at(C.edges.a + 15, [tp53, mdm2], 2.2), [C.edges.b, 20, 200, 3.0, 0, 0],
    at(C.degree.a + 3, [tp53], 2.4, 25), at(C.degree.b - 4, [tp53], 2.6, 25),
    [C.essential.a + 3, 10, 260, 3.0, 0, 0], [C.essential.b, 5, 330, 3.0, 0, 0],
    [C.communities.a + 2, 20, 330, 3.2, 0, 0], [C.communities.b, 15, 490, 3.2, 0, 0, 'east', 'spin'],
    spinAround(at(C.disease.a + 3, breast, 2.5), -30), spinAround(at(C.disease.b - 1, breast, 2.6), 30, 'spin'),
    at(C.paths.a + 3, [parp1, ...breast], 2.6)];
  if (path) wp.push(at(C.paths.a + 12, path, 2.6), at(C.paths.b - 2, path, 2.8));
  wp.push([C.robustness.a + 5, 25, 40, 3.1, 0, 0], [C.robustness.b, 20, 120, 3.1, 0, 0], [C.outro.b, 18, 200, 3.4, 0, 0]);
  wp.sort((x, y) => x[0] - y[0]);
  let prev = null;
  ST.wp = wp.map(w => {
    let lon = w[2];
    if (prev !== null) lon = w[6] === 'east' ? prev + (((w[2] - prev) % 360) + 360) % 360 : w[2] + 360 * Math.round((prev - w[2]) / 360);
    prev = lon;
    return [w[0], w[1], lon, w[3], w[4], w[5], w[7]];
  });
}
// 0..1 progress over a segment of length D: smoothstep, or for 'spin' segments a steady
// slow turn with short eased starts and stops (trapezoidal speed profile)
const smoothSeg = (t, D) => smooth(t / D);
function spinEase(t, D) {
  const r = Math.min(2.5, D / 3);
  if (t <= 0) return 0;
  if (t >= D) return 1;
  const v = 1 / (D - r); // cruise speed so the ramps plus cruise cover 0..1
  if (t < r) return v * t * t / (2 * r);
  if (t > D - r) return 1 - v * (D - t) * (D - t) / (2 * r);
  return v * (t - r / 2);
}
function storyCam(t) {
  const wp = ST.wp;
  if (t <= wp[0][0]) return wp[0].slice(1);
  for (let i = 1; i < wp.length; i++) {
    if (t <= wp[i][0]) {
      const a = wp[i - 1], b = wp[i], x = (b[6] === 'spin' ? spinEase : smoothSeg)(t - a[0], b[0] - a[0]);
      return [a[1] + (b[1] - a[1]) * x, a[2] + (b[2] - a[2]) * x, Math.exp(Math.log(a[3]) + (Math.log(b[3]) - Math.log(a[3])) * x),
        a[4] + (b[4] - a[4]) * x, a[5] + (b[5] - a[5]) * x];
    }
  }
  return wp[wp.length - 1].slice(1);
}

// ---------------------------------------------------------------- labels --
const LBL = { story: ST.labels, extra: [] };
function label(i, html, h, tIn, tOut, cls) {
  const el = document.createElement('div');
  el.className = 'lbl ' + (cls || '');
  el.innerHTML = html;
  el.style.opacity = 0;
  $('#labels').appendChild(el);
  ST.labels.push({ el, i, h, tIn, tOut, o: -1 });
}
const _v = new THREE.Vector3();
function placeLabel(L, alpha, S) {
  const { P } = NET, i = L.i, cam = GL.camera.position;
  const h = L.h === 'deg' ? GL.attr.aHDeg[i] * S.deg_h + GL.attr.aHBtw[i] * S.btw_h
    : L.h === 'btw' ? GL.attr.aHDeg[i] * S.deg_h + GL.attr.aHBtw[i] * S.btw_h : 0;
  nodePos(i, h + 0.01, _v);
  const vis = 1; // the cell is see-through
  const o = Math.round(alpha * vis * 100) / 100;
  if (o !== L.o) { L.el.style.opacity = o; L.o = o; }
  if (o <= 0) return;
  _v.project(GL.camera);
  const x = (_v.x * 0.5 + 0.5) * window.innerWidth, y = (-_v.y * 0.5 + 0.5) * window.innerHeight;
  L.el.style.transform = `translate(${(x + 9).toFixed(1)}px, ${(y - 11).toFixed(1)}px)`;
}

// ------------------------------------------------------------ panel update --
let curCh = null;
function updateStoryDOM(t) {
  const c = CH.find(c => t >= c.a && t < c.b) || CH[CH.length - 1];
  if (c !== curCh) {
    const fs = ST.focusSets && ST.focusSets[c.key];
    if (c.key === 'paths' || !fs) setPathAttribute(fs || null);
    else setFocusSet(fs);
    ST.items.forEach(it => it.sec.classList.toggle('on', it.ch === c));
    curCh = c;
    $('#panel').scrollTop = 0;
  }
  const it = ST.items.find(x => x.ch === c);
  let fresh = null;
  for (const e of it.els) {
    const o = Math.round(fadeVal(t, e.at, e.out, 0.6) * 100) / 100;
    if (o !== e.o) {
      if (e.o <= 0 && o > 0 && !e.el.classList.contains('credits')) fresh = e.el;
      e.el.style.opacity = o; e.o = o; e.el.style.visibility = o > 0 ? 'visible' : 'hidden';
    }
  }
  // on a short (phone) panel, scroll just far enough that a line that has just appeared is not below the fold
  if (fresh) {
    const p = $('#panel'), over = fresh.getBoundingClientRect().bottom - (p.getBoundingClientRect().bottom - parseFloat(getComputedStyle(p).paddingBottom));
    if (over > 0) p.scrollTo({ top: p.scrollTop + over, behavior: 'smooth' });
  }
  for (const g of it.grow) {
    const s = Math.round(smooth((t - g.at) / 1.2) * 100) / 100;
    if (s !== g.s) { g.el.style.transform = `scaleY(${s})`; g.s = s; }
  }
  if (c.key === 'title') {
    const arc = $('#titleArc');
    if (arc) { arc.setAttribute('stroke-dashoffset', (1 - smooth((t - 0.5) / 2.2)).toFixed(3)); $('#titleDot').setAttribute('opacity', smooth((t - 2.5) / 0.4)); }
  }
  if (c.key === 'paths') {
    const n = ST.hopEnds.filter(x => t >= x).length;
    $('#flights').textContent = n;
    $('#flightsWord').textContent = n === 1 ? 'step' : 'steps';
  }
  if (c.key === 'robustness') {
    let s = ST.robSteps[0];
    for (const x of ST.robSteps) if (t >= x[0]) s = x;
    const el = $('#robPct'), txt = Math.round(s[1] * 100) + '%';
    if (el.textContent !== txt) { el.textContent = txt; el.className = 'big ' + s[2]; }
  }
}

// ------------------------------------------------------------- timeline UI --
function buildTimeline() {
  const tr = $('#track');
  tr.innerHTML = '<div class="rail"></div><div class="done"></div>' + CH.slice(1).map(c =>
    `<div class="tick" data-k="${c.key}" style="left:${(100 * c.na / T_END).toFixed(2)}%"></div><div class="name" data-k="${c.key}" style="left:${(100 * c.na / T_END).toFixed(2)}%">${c.name}</div>`).join('') + '<div class="knob"></div>';
  const seekAt = ev => {
    const r = tr.getBoundingClientRect();
    APP.seek(clamp((ev.clientX - r.left) / r.width, 0, 1) * T_END);
  };
  let drag = false;
  tr.addEventListener('pointerdown', ev => { drag = true; tr.setPointerCapture(ev.pointerId); seekAt(ev); });
  tr.addEventListener('pointermove', ev => { if (drag) seekAt(ev); });
  tr.addEventListener('pointerup', () => { drag = false; });
  tr.addEventListener('keydown', ev => {
    if (ev.key === 'ArrowRight') { APP.seek(APP.t + 5); ev.preventDefault(); }
    if (ev.key === 'ArrowLeft') { APP.seek(APP.t - 5); ev.preventDefault(); }
  });
  $('#play').addEventListener('click', () => APP.togglePlay());
}
const ICON_PLAY = '<svg viewBox="0 0 16 16"><path d="M4 2.5v11l9-5.5z"/></svg>';
const ICON_PAUSE = '<svg viewBox="0 0 16 16"><path d="M3.5 2.5h3v11h-3zM9.5 2.5h3v11h-3z"/></svg>';
let lastTick = -1;
function updateTimeline(t, playing) {
  const p = (100 * t / T_END).toFixed(2);
  if (p !== lastTick) {
    $('#track .done').style.width = p + '%';
    $('#track .knob').style.left = p + '%';
    $('#track').setAttribute('aria-valuenow', Math.round(t));
    const m = s => Math.floor(s / 60) + ':' + String(Math.floor(s % 60)).padStart(2, '0');
    $('#clock').textContent = m(t) + ' / ' + m(T_END);
    const c = CH.find(c => t >= c.na && t < c.nb) || CH[CH.length - 1];
    document.querySelectorAll('#track .name').forEach(n => n.classList.toggle('cur', n.dataset.k === c.key));
    lastTick = p;
  }
  const want = playing ? 'pause' : 'play';
  const btn = $('#play');
  if (btn.dataset.s !== want) { btn.innerHTML = playing ? ICON_PAUSE : ICON_PLAY; btn.dataset.s = want; btn.setAttribute('aria-label', playing ? 'Pause' : 'Play'); }
}


// ================================================================ EXPLORE ==
const X = { color: 'plain', pillars: 'off', routes: 0.65, sel: -1, path: null, count: 0, iso: -1,
  closeMode: 'btw', closeK: 0, manual: new Set(), tab: 'airport', hubsBy: 'deg' };
const XS = Object.assign({}, DEF, { node_reveal: 1, route_reveal: 1, xrm: 1, sel_prog: 0 });
const orbit = { cur: [26, -55, 3.5, 0, 0], from: null, to: null, t0: 0, dur: 1.4 };
const PERM = permutation(7);
let removed = new Uint8Array(NET.N);
const commColor = k => 'rgb(' + COMM_COLORS[k].map(v => Math.round(v * 255)).join(',') + ')';
const anyRemoved = () => removed.some(x => x);

function exploreStep(dt) {
  const k = 1 - Math.exp(-dt * 5);
  const tg = { w_deg: X.color === 'deg' ? 1 : 0, w_btw: X.color === 'btw' ? 1 : 0, w_comm: X.color === 'comm' ? 1 : 0,
    deg_h: X.pillars === 'deg' ? 1 : 0, btw_h: X.pillars === 'btw' ? 1 : 0,
    route_alpha: X.routes * (X.path && X.tab === 'path' ? 0.3 : 1), path_focus: X.path && X.tab === 'path' ? 1 : 0,
    rnd_rm: 0, tgt_rm: 0 };
  for (const n in tg) XS[n] += (tg[n] - XS[n]) * k;
  if (X.path) XS.path_prog = Math.min(X.path.length - 1, XS.path_prog + dt * 1.4);
  XS.sel_prog = Math.min(1, XS.sel_prog + dt * 0.7);
  return XS;
}
function applyUniforms(S, explore) {
  const U = GL.U, RU = GL.RU;
  U.uReveal.value = S.node_reveal; U.uWDeg.value = S.w_deg; U.uWBtw.value = S.w_btw; U.uWComm.value = S.w_comm;
  U.uFocus.value = S.path_focus; U.uPathProg.value = S.path_prog; U.uRndRm.value = S.rnd_rm; U.uTgtRm.value = S.tgt_rm;
  U.uXrm.value = S.xrm; U.uDegH.value = S.deg_h; U.uBtwH.value = S.btw_h;
  U.uIso.value = explore ? X.iso : -1; U.uSel.value = explore ? X.sel : -1;
  RU.uReveal.value = S.route_reveal; RU.uAlpha.value = 0.55 * S.route_alpha; RU.uWComm.value = S.w_comm;
  RU.uRndRm.value = S.rnd_rm; RU.uTgtRm.value = S.tgt_rm; RU.uXrm.value = S.xrm; RU.uIso.value = U.uIso.value;
  GL.pillars.visible = S.deg_h + S.btw_h > 0.002;
  const H = GL.highlights;
  const set = (k, p, a) => { const m = H[k]; if (!m) return; m.material.uniforms.uProg.value = p; m.material.uniforms.uAlpha.value = a; m.visible = a > 0.003 && p > 0.001; };
  set('ex', S.ex_prog, explore ? 0 : S.ex_alpha);
  set('ex2', S.ex2_prog, explore ? 0 : S.ex2_alpha);
  set('ams', S.ams_prog, explore ? 0 : S.ams_alpha);
  set('anc', S.anc_prog, explore ? 0 : S.anc_alpha);
  set('path', S.path_prog, explore ? 0 : S.path_alpha);
  set('sel', XS.sel_prog, explore ? 0.9 : 0);
  set('xpath', XS.path_prog, explore ? 1 : 0);
}
const LV = new THREE.Vector3();
function updateLight(xr) {
  GL.rig.updateMatrixWorld(true);
  GL.atmMat.uniforms.uCenter.value.setFromMatrixPosition(GL.world.matrixWorld);
  GL.atmMat.uniforms.uRadius.value = GL.world.scale.x;
  if (xr) {
    // light from the viewer's upper left, fixed in the room
    LV.set(-0.55, 0.42, 1.0).normalize().applyQuaternion(GL.rig.quaternion);
    GL.globeMat.uniforms.uL.value.copy(LV);
    GL.U.uScale.value = 1;
    GL.U.uPx.value = XR.pointK * XR.R * XR.viewH * 0.5;
    return;
  }
  GL.U.uPx.value = 0;
  LV.set(-0.55, 0.42, 1.0).normalize().applyQuaternion(GL.camera.quaternion);
  GL.globeMat.uniforms.uL.value.copy(LV);
  GL.U.uScale.value = GL.renderer.getPixelRatio() * clamp(3.6 / GL.camera.position.length(), 0.75, 2.4);
}

// ------------------------------------------------------------- search box --
function matches(q, limit) {
  q = q.trim().toLowerCase();
  if (!q) return [];
  const res = [];
  for (const i of NET.degOrd) {
    const c = NET.code[i].toLowerCase(), ci = NET.city[i].toLowerCase();
    let s = -1;
    if (c === q) s = 0; else if (c.startsWith(q)) s = 1; else if (ci.startsWith(q)) s = 2;
    else if (ci.includes(q) || NET.name[i].toLowerCase().includes(q) || NET.country[i].toLowerCase().startsWith(q)) s = 3;
    if (s >= 0) res.push([s, i]);
  }
  return res.sort((a, b) => a[0] - b[0]).slice(0, limit || 8).map(r => r[1]);
}
const findAirport = s => { const m = matches(s, 1); return m.length ? m[0] : -1; };
function attachSuggest(input, list, onPick) {
  let items = [], hi = -1;
  const close = () => { list.classList.remove('on'); input.setAttribute('aria-expanded', 'false'); hi = -1; };
  const render = () => {
    const q = input.value;
    items = /\s(to|-|–|>)\s/i.test(q) ? [] : matches(q, 8);
    if (!items.length) { close(); return; }
    list.innerHTML = items.map((i, k) => `<li role="option" data-i="${i}" aria-selected="${k === hi}"><b>${esc(NET.code[i])}</b><span>${esc(NET.city[i])}, ${esc(NET.country[i])}</span><em>${NET.deg[i]} partners</em></li>`).join('');
    list.classList.add('on'); input.setAttribute('aria-expanded', 'true');
  };
  input.addEventListener('input', () => { hi = -1; render(); });
  input.addEventListener('focus', render);
  input.addEventListener('blur', () => setTimeout(close, 150));
  input.addEventListener('keydown', ev => {
    if (ev.key === 'ArrowDown' || ev.key === 'ArrowUp') {
      if (!items.length) return;
      hi = (hi + (ev.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length; render(); ev.preventDefault();
    } else if (ev.key === 'Enter') {
      const pick = hi >= 0 ? items[hi] : null;
      close(); onPick(pick, input.value); ev.preventDefault();
    } else if (ev.key === 'Escape') close();
  });
  list.addEventListener('mousedown', ev => {
    const li = ev.target.closest('li');
    if (li) { ev.preventDefault(); close(); onPick(+li.dataset.i, input.value); }
  });
}
function runQuery(q) {
  const parts = q.split(/\s+(?:to|->|-|–|—|>)\s+/i);
  if (parts.length === 2) {
    const s = findAirport(parts[0]), t = findAirport(parts[1]);
    showTab('path');
    $('#pf').value = s >= 0 ? NET.code[s] : parts[0]; $('#pt').value = t >= 0 ? NET.code[t] : parts[1];
    runPath(s, t);
  } else {
    const i = findAirport(q);
    if (i >= 0) { showTab('airport'); selectAirport(i); } else renderAirport(-2, q);
  }
}

// ------------------------------------------------------------------ panes --
function buildExplore() {
  const tabs = [['airport', 'Protein'], ['path', 'Paths'], ['hubs', 'Hubs'], ['communities', 'Modules'], ['closures', 'Knockouts']];
  $('#explore').innerHTML = `
    <div class="search"><input id="q" type="search" placeholder="Search a protein, or type TP53 to BRCA1" autocomplete="off" spellcheck="false" aria-label="Search proteins or a path" role="combobox" aria-expanded="false" aria-controls="qs"><ul class="sugg" id="qs" role="listbox"></ul></div>
    <div class="tabs" role="tablist">${tabs.map(([k, n]) => `<button role="tab" type="button" data-tab="${k}" aria-selected="${k === 'airport'}">${n}</button>`).join('')}</div>
    ${tabs.map(([k]) => `<div class="pane${k === 'airport' ? ' on' : ''}" id="pane-${k}" role="tabpanel"></div>`).join('')}`;
  attachSuggest($('#q'), $('#qs'), (i, text) => {
    if (i !== null && i !== undefined) { $('#q').value = NET.code[i]; showTab('airport'); selectAirport(i); } else runQuery(text);
  });
  document.querySelectorAll('.tabs button').forEach(b => b.addEventListener('click', () => showTab(b.dataset.tab)));
  $('#pane-path').innerHTML = `
    <h3>Shortest paths</h3><p class="sub">Fewest interaction steps between two proteins. Knocked-out proteins are avoided.</p>
    <div class="row"><div class="field"><label for="pf">From</label><input id="pf" autocomplete="off" spellcheck="false"><ul class="sugg" id="pfs"></ul></div>
    <div class="field"><label for="pt">To</label><input id="pt" autocomplete="off" spellcheck="false"><ul class="sugg" id="pts"></ul></div></div>
    <div class="actions"><button class="btn primary" type="button" id="pgo">Find shortest path</button>
    <button class="btn" type="button" data-pre="BACE1 BRCA1">BACE1 to BRCA1</button><button class="btn" type="button" data-pre="ORC6 TNF">Most remote pair</button>
    <button class="btn" type="button" id="prand">Random pair</button></div><div id="presult"></div>`;
  const pickField = id => (i, text) => { const v = i !== null && i !== undefined ? i : findAirport(text); if (v >= 0) $(id).value = NET.code[v]; };
  attachSuggest($('#pf'), $('#pfs'), pickField('#pf'));
  attachSuggest($('#pt'), $('#pts'), pickField('#pt'));
  $('#pgo').addEventListener('click', () => runPath(findAirport($('#pf').value), findAirport($('#pt').value)));
  $('#pane-path').querySelectorAll('[data-pre]').forEach(b => b.addEventListener('click', () => {
    const [s, t] = b.dataset.pre.split(' ');
    $('#pf').value = s; $('#pt').value = t; runPath(A(s), A(t));
  }));
  $('#prand').addEventListener('click', () => {
    const r = Math.random, s = Math.floor(r() * NET.N), t = Math.floor(r() * NET.N);
    $('#pf').value = NET.code[s]; $('#pt').value = NET.code[t]; runPath(s, t);
  });
  renderAirport(-1); renderHubs(); renderCommunities(); renderClosures(); renderPathResult();

  // view controls in the bottom bar
  const seg = (name, opts) => `<div class="seg" data-ctl="${name}" role="group" aria-label="${name}">${opts.map(([v, n]) => `<button type="button" data-v="${v}" aria-pressed="${X[name] === v}">${n}</button>`).join('')}</div>`;
  $('#viewctl').innerHTML = `
    <div class="grp"><span>Color</span>${seg('color', [['plain', 'Plain'], ['deg', 'Partners'], ['btw', 'Betweenness'], ['comm', 'Module']])}</div>
    <div class="grp"><span>Pillars</span>${seg('pillars', [['off', 'Off'], ['deg', 'Partners'], ['btw', 'Betweenness']])}</div>
    <div class="grp opt"><span>Interaction lines</span><input type="range" id="rta" min="0" max="1.6" step="0.05" value="${X.routes}" aria-label="Interaction line brightness"></div>`;
  $('#viewctl').addEventListener('click', ev => {
    const b = ev.target.closest('[data-v]');
    if (!b) return;
    setView(b.parentElement.dataset.ctl, b.dataset.v);
  });
  $('#rta').addEventListener('input', ev => { X.routes = +ev.target.value; });
}
function setView(name, v) {
  X[name] = v;
  document.querySelectorAll(`[data-ctl="${name}"] button`).forEach(b => b.setAttribute('aria-pressed', b.dataset.v === v));
  updateExtraLabels();
}
function showTab(k) {
  X.tab = k;
  document.querySelectorAll('.tabs button').forEach(b => b.setAttribute('aria-selected', b.dataset.tab === k));
  document.querySelectorAll('.pane').forEach(p => p.classList.toggle('on', p.id === 'pane-' + k));
  if (k === 'hubs' && X.pillars === 'off') { setView('pillars', X.hubsBy); setView('color', X.hubsBy); }
  if (k === 'communities') setView('color', 'comm');
  if (k === 'closures') { renderClosures(true); if (X.color === 'comm') setView('color', 'plain'); }
  if (k !== 'communities' && X.iso >= 0) { X.iso = -1; renderCommunities(); }
  updateExtraLabels();
}
function renderAirport(i, q) {
  const pane = $('#pane-airport');
  if (i < 0) {
    pane.innerHTML = `${i === -2 ? `<p class="empty">No protein matches “${esc(q)}”. Try a gene symbol like TP53, or a name like insulin.</p>` : '<p class="empty">Search above, or click any protein in the cell, to see its partners, rank and reach.</p>'}
      <div class="quick">${['TP53', 'BRCA1', 'EGFR', 'CTNNB1', 'APP', 'PSMA3'].map(c => `<button type="button" data-c="${c}">${c} ${esc(NET.city[A(c)])}</button>`).join('')}</div>`;
    pane.querySelectorAll('[data-c]').forEach(b => b.addEventListener('click', () => selectAirport(A(b.dataset.c))));
    return;
  }
  const { code, name, city, country, deg, btw, comm } = NET;
  const { dist, order, n } = bfs(i, anyRemoved() ? removed : null);
  let sum = 0, far = i;
  for (let q2 = 1; q2 < n; q2++) { const v = order[q2]; sum += dist[v]; if (dist[v] > dist[far] || (dist[v] === dist[far] && deg[v] > deg[far])) far = v; }
  const nb = Array.from(NET.adj.slice(NET.adjS[i], NET.adjS[i + 1])).sort((a, b) => deg[b] - deg[a]);
  const closed = removed[i];
  pane.innerHTML = `<h3>${esc(code[i])} ${esc(name[i])}</h3><p class="sub">${esc(city[i])}, ${esc(country[i])}</p>
    <dl class="stats">
      <dt>Partners</dt><dd>${deg[i]}<small>degree, rank ${fmt(NET.degRank[i])} of ${fmt(NET.N)}</small></dd>
      <dt>Betweenness</dt><dd>${(btw[i] * 100).toFixed(2)}%<small>of shortest paths between other proteins pass through, rank ${fmt(NET.btwRank[i])}</small></dd>
      <dt>Module</dt><dd><span class="sw" style="display:inline-block;vertical-align:-1px;margin-right:6px;background:${commColor(comm[i])}"></span>${COMM_NAMES[comm[i]]}</dd>
      <dt>Reach</dt><dd>${closed ? 'Knocked out' : n > 1 ? `${(sum / (n - 1)).toFixed(2)} steps on average to ${fmt(n - 1)} proteins<small>farthest: ${dist[far]} steps, to ${esc(code[far])} ${esc(city[far])}</small>` : 'No connections'}</dd>
    </dl>
    <div class="actions"><button class="btn" type="button" id="aPath">Find a path from here</button>
    <button class="btn" type="button" id="aClose">${closed && X.manual.has(i) ? 'Restore this protein' : 'Knock out this protein'}</button></div>
    <p class="caption">Binds ${deg[i]} proteins, biggest hubs first</p>
    <div class="chips">${nb.slice(0, 48).map(j => `<button type="button" data-i="${j}" title="${esc(city[j])}">${esc(code[j])}</button>`).join('')}${nb.length > 48 ? `<span class="caption">and ${nb.length - 48} more</span>` : ''}</div>`;
  pane.querySelector('.chips').addEventListener('click', ev => { const b = ev.target.closest('[data-i]'); if (b) selectAirport(+b.dataset.i); });
  $('#aPath').addEventListener('click', () => { $('#pf').value = code[i]; $('#pt').value = ''; showTab('path'); $('#pt').focus(); });
  $('#aClose').addEventListener('click', () => {
    if (X.manual.has(i)) X.manual.delete(i); else X.manual.add(i);
    updateClosures(); renderAirport(i);
  });
}
function selectAirport(i, fly = true) {
  X.sel = i;
  if (i >= 0) {
    const nb = Array.from(NET.adj.slice(NET.adjS[i], NET.adjS[i + 1])).filter(j => !removed[j] && !removed[i]);
    setHighlight('sel', nb.map(j => [i, j]), [0.30, 0.88, 1.0], { radius: 0.0015, spread: 0.5, seed: i + 1 });
    XS.sel_prog = 0;
    if (fly) flyTo(NET.lat[i], NET.lon[i], Math.min(Math.max(orbit.cur[2], 1.6), 2.6));
    if (fly && X.tab !== 'airport' && X.tab !== 'path') showTab('airport');
  } else setHighlight('sel', null);
  renderAirport(i);
  if (X.tab === 'hubs') renderHubs();
  updateExtraLabels();
}
function runPath(s, t) {
  X.pathErr = null;
  if (s < 0 || t < 0) X.pathErr = 'Pick two proteins from the suggestions, for example TP53 and BRCA1.';
  else if (s === t) X.pathErr = 'Pick two different proteins.';
  const res = X.pathErr ? null : bestPath(s, t, anyRemoved() ? removed : null);
  if (!X.pathErr && !res) X.pathErr = removed[s] || removed[t] ? 'One of these proteins is knocked out. Restore it in Knockouts.' : 'No path connects these proteins' + (anyRemoved() ? ' with the current knockouts.' : '.');
  X.path = res ? res.path : null; X.count = res ? res.count : 0; X.pathEnds = [s, t];
  XS.path_prog = 0;
  setPathAttribute(X.path);
  setHighlight('xpath', X.path ? X.path.slice(0, -1).map((p, k) => [p, X.path[k + 1]]) : null, [1.0, 0.35, 0.86],
    { radius: 0.0034, hops: X.path ? X.path.slice(0, -1).map((_, k) => k + 1) : null });
  renderPathResult(); updateExtraLabels();
  if (X.path) {
    const c = [0, 0, 0];
    X.path.forEach(i => { for (let k = 0; k < 3; k++) c[k] += NET.P[3 * i + k]; });
    const n = Math.hypot(...c) || 1, u = c.map(x => x / n);
    let spread = 0;
    X.path.forEach(i => { spread = Math.max(spread, Math.acos(clamp(u[0] * NET.P[3 * i] + u[1] * NET.P[3 * i + 1] + u[2] * NET.P[3 * i + 2], -1, 1))); });
    flyTo(Math.asin(clamp(u[1], -1, 1)) / D2R, Math.atan2(-u[2], u[0]) / D2R, clamp(0.9 + 3.2 * Math.sin(Math.min(spread, 1.5)), 1.4, 3.6));
  }
}
function renderPathResult() {
  const el = $('#presult');
  if (!el) return;
  if (X.pathErr) { el.innerHTML = `<p class="empty">${esc(X.pathErr)}</p>`; return; }
  if (!X.path) { el.innerHTML = '<p class="empty">Choose two proteins, or try one of the examples.</p>'; return; }
  const p = X.path, L = p.length - 1, { code, city } = NET;
  el.innerHTML = `<div class="result magenta">${L} ${L === 1 ? 'step' : 'steps'}</div>
    <p class="sub">From ${esc(code[p[0]])} to ${esc(code[p[L]])} through ${L - 1} ${L === 2 ? 'protein' : 'proteins'} in between.
    ${X.count > 1 ? `It is one of ${fmt(X.count)} equally short paths.` : 'It is the only path this short.'}</p>
    <ol class="hops">${p.slice(0, -1).map((a, k) => `<li><div><b>${esc(code[a])}</b> binds <b>${esc(code[p[k + 1]])}</b><br><span>${esc(city[a])} · ${esc(city[p[k + 1]])}</span></div><span></span></li>`).join('')}</ol>`;
}
function degBarsHTML(hl) {
  const bins = [[1, 1], [2, 2], [3, 4], [5, 8], [9, 16], [17, 32], [33, 64], [65, 128], [129, 256]];
  const counts = bins.map(([lo, hi]) => Array.from(NET.deg).filter(d => d >= lo && d <= hi).length), mx = Math.max(...counts);
  return `<div class="bars">${bins.map(([lo, hi], k) => `<div class="bar${hl >= lo && hl <= hi ? ' hl' : ''}"><span class="v">${fmt(counts[k])}</span>
    <div class="fill" style="height:${(100 * counts[k] / mx).toFixed(1)}%;background:${hl >= lo && hl <= hi ? 'var(--cyan)' : 'var(--amber)'};opacity:${hl >= lo && hl <= hi ? 1 : 0.75}"></div>
    <span class="k">${lo === hi ? lo : k === 8 ? lo + '+' : lo + '–' + hi}</span></div>`).join('')}</div>`;
}
function renderHubs() {
  const by = X.hubsBy, ord = by === 'deg' ? NET.degOrd : NET.btwOrd, { code, city, deg, btw } = NET;
  const top = NET.degOrd.slice(0, 10).reduce((s, i) => s + deg[i], 0) / (2 * NET.E);
  $('#pane-hubs').innerHTML = `<h3>Hubs</h3>
    <p class="sub">The 10 biggest hubs (4% of these proteins) hold ${Math.round(top * 100)}% of all interaction ends.</p>
    <div class="seg" role="group" aria-label="Rank by" style="margin-bottom:12px"><button type="button" data-by="deg" aria-pressed="${by === 'deg'}">Most partners</button><button type="button" data-by="btw" aria-pressed="${by === 'btw'}">Highest betweenness</button></div>
    <ol class="rank">${ord.slice(0, 15).map((i, k) => `<li data-i="${i}"><i>${k + 1}</i><b>${esc(code[i])}</b><span>${esc(city[i])}</span><em>${by === 'deg' ? deg[i] : (btw[i] * 100).toFixed(2) + '%'}</em></li>`).join('')}</ol>
    <p class="caption" style="margin-top:18px">Proteins by number of partners${X.sel >= 0 ? `, with ${esc(code[X.sel])} marked` : ''}</p>${degBarsHTML(X.sel >= 0 ? deg[X.sel] : -1)}`;
  $('#pane-hubs').querySelectorAll('[data-by]').forEach(b => b.addEventListener('click', () => {
    X.hubsBy = b.dataset.by; setView('pillars', X.hubsBy); setView('color', X.hubsBy); renderHubs();
  }));
  $('#pane-hubs').querySelector('.rank').addEventListener('click', ev => { const li = ev.target.closest('[data-i]'); if (li) { selectAirport(+li.dataset.i); showTab('hubs'); } });
}
function renderCommunities() {
  if (!X.commStats) {
    const s = COMM_NAMES.map(() => ({ n: 0, inside: 0, touch: 0, hubs: [] }));
    for (let i = 0; i < NET.N; i++) s[NET.comm[i]].n++;
    for (let e = 0; e < NET.E; e++) {
      const a = NET.comm[NET.eu[e]], b = NET.comm[NET.ev[e]];
      s[a].touch++; if (a !== b) s[b].touch++; else s[a].inside++;
    }
    NET.degOrd.forEach(i => { const h = s[NET.comm[i]].hubs; if (h.length < 3) h.push(NET.code[i]); });
    X.commStats = s;
  }
  const s = X.commStats;
  $('#pane-communities').innerHTML = `<h3>Modules</h3>
    <p class="sub">Louvain found ${STATS.nComm} modules (modularity ${STATS.q.toFixed(2)}). Select one to isolate it in the cell.</p>
    <ul class="legend comm">${COMM_NAMES.map((n, k) => `<li data-c="${k}" tabindex="0" role="button" aria-pressed="${X.iso === k}"><span class="sw" style="background:${commColor(k)}"></span>${n}<em>${fmt(s[k].n)} proteins</em>
      <small>${`Hubs ${s[k].hubs.join(', ')}. ${Math.round(100 * s[k].inside / s[k].touch)}% of its interactions stay inside.`}</small></li>`).join('')}</ul>`;
  const toggle = li => { const k = +li.dataset.c; X.iso = X.iso === k ? -1 : k; setView('color', 'comm'); renderCommunities(); };
  $('#pane-communities').querySelectorAll('[data-c]').forEach(li => {
    li.addEventListener('click', () => toggle(li));
    li.addEventListener('keydown', ev => { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); toggle(li); } });
  });
}
function curveData() {
  if (X.curve) return X.curve;
  const ks = [], tgt = [], deg = [], rnd = [];
  const perms = [PERM, permutation(11), permutation(12), permutation(13)];
  for (let k = 0; k <= 60; k += 2) {
    const m = new Uint8Array(NET.N), m2 = new Uint8Array(NET.N);
    for (let j = 0; j < k; j++) { m[NET.btwOrd[j]] = 1; m2[NET.degOrd[j]] = 1; }
    let r = 0;
    for (const p of perms) { const m3 = new Uint8Array(NET.N); for (let j = 0; j < k; j++) m3[p[j]] = 1; r += connectivity(m3).pairs; }
    ks.push(k); tgt.push(connectivity(m).pairs); deg.push(connectivity(m2).pairs); rnd.push(r / perms.length);
  }
  return (X.curve = { ks, tgt, deg, rnd });
}
function renderClosures(withCurve) {
  const pane = $('#pane-closures');
  if (!pane.dataset.built) {
    pane.dataset.built = 1;
    pane.innerHTML = `<h3>Knockouts</h3><p class="sub">Knock out proteins and see how much of the network still hangs together.</p>
      <div class="seg" role="group" aria-label="Which proteins go first" style="margin-bottom:14px">
        <button type="button" data-m="btw" aria-pressed="true">Most central first</button><button type="button" data-m="deg" aria-pressed="false">Most partners first</button><button type="button" data-m="rnd" aria-pressed="false">Random</button></div>
      <label for="kslider" class="caption" style="display:block">Proteins knocked out: <b id="kval">0</b></label>
      <input type="range" id="kslider" min="0" max="60" step="1" value="0">
      <div class="result" id="cres"></div><p class="sub">of protein pairs can still reach each other</p>
      <dl class="stats"><dt>Largest group</dt><dd id="clcc"></dd><dt>Interactions lost</dt><dd id="clost"></dd></dl>
      <svg class="curve" id="curve" viewBox="0 0 300 150" preserveAspectRatio="none" role="img" aria-label="Connected pairs as proteins are knocked out"></svg>
      <p class="caption"><span class="red">Most central first</span>, <span class="amber">most partners first</span> and <span class="green">random</span>, up to 60 knockouts.</p>
      <p class="caption">Knocked out by hand:</p><div class="closed" id="manual"></div>
      <div class="actions"><button class="btn" type="button" id="reopen">Restore all proteins</button></div>`;
    pane.querySelectorAll('[data-m]').forEach(b => b.addEventListener('click', () => {
      X.closeMode = b.dataset.m; pane.querySelectorAll('[data-m]').forEach(x => x.setAttribute('aria-pressed', x === b)); updateClosures();
    }));
    $('#kslider').addEventListener('input', ev => { X.closeK = +ev.target.value; updateClosures(); });
    $('#reopen').addEventListener('click', () => { X.closeK = 0; X.manual.clear(); $('#kslider').value = 0; updateClosures(); });
    $('#manual').addEventListener('click', ev => { const b = ev.target.closest('[data-i]'); if (b) { X.manual.delete(+b.dataset.i); updateClosures(); } });
  }
  const r = connectivity(removed);
  $('#kval').textContent = X.closeK + (X.manual.size ? ` plus ${X.manual.size} by hand` : '');
  $('#cres').textContent = (r.pairs * 100).toFixed(1) + '%';
  $('#cres').className = 'result ' + (r.pairs > 0.9 ? 'green' : r.pairs > 0.7 ? 'amber' : 'red');
  $('#clcc').innerHTML = `${(r.lcc * 100).toFixed(1)}%<small>of proteins in one connected piece</small>`;
  $('#clost').innerHTML = `${fmt(r.lost)}<small>of ${fmt(NET.E)}</small>`;
  $('#manual').innerHTML = X.manual.size ? Array.from(X.manual).map(i => `<button type="button" data-i="${i}" aria-label="Restore ${esc(NET.code[i])}">${esc(NET.code[i])} ✕</button>`).join('') : '<span class="caption">none yet. Use Knock out this protein on any protein.</span>';
  if (withCurve || X.curve) {
    const cd = curveData(), y = v => (150 - v * 140).toFixed(1), xk = k => (k / 60 * 300).toFixed(1);
    const line = (arr, col) => `<polyline fill="none" stroke="${col}" stroke-width="2" vector-effect="non-scaling-stroke" points="${cd.ks.map((k, j) => xk(k) + ',' + y(arr[j])).join(' ')}"/>`;
    const k = Math.min(60, X.closeK);
    $('#curve').innerHTML = `<line x1="0" x2="300" y1="${y(0.5)}" y2="${y(0.5)}" stroke="var(--line)" vector-effect="non-scaling-stroke"/>
      ${line(cd.rnd, 'var(--green)')}${line(cd.deg, 'var(--amber)')}${line(cd.tgt, 'var(--red)')}
      <line x1="${xk(k)}" x2="${xk(k)}" y1="0" y2="150" stroke="var(--ink)" stroke-dasharray="3 3" vector-effect="non-scaling-stroke"/>`;
  }
}
function updateClosures() {
  removed = new Uint8Array(NET.N);
  const ord = X.closeMode === 'btw' ? NET.btwOrd : X.closeMode === 'deg' ? NET.degOrd : PERM;
  for (let k = 0; k < X.closeK; k++) removed[ord[k]] = 1;
  X.manual.forEach(i => { removed[i] = 1; });
  setClosedAttributes(removed);
  renderClosures();
  if (X.sel >= 0) selectAirport(X.sel, false);
  if (X.path || X.pathErr) runPath(X.pathEnds[0], X.pathEnds[1]);
}
function updateExtraLabels() {
  LBL.extra.forEach(L => { L.el.remove(); dropSprite(L); });
  LBL.extra = [];
  const add = (i, html, cls) => {
    const el = document.createElement('div');
    el.className = 'lbl ' + cls; el.innerHTML = html; el.style.opacity = 0;
    $('#labels').appendChild(el);
    LBL.extra.push({ el, i, h: 'deg', o: -1 });
  };
  const { code, city, deg, btw } = NET;
  if (X.pillars !== 'off') (X.pillars === 'deg' ? NET.degOrd : NET.btwOrd).slice(0, 8).forEach(i => {
    if (i !== X.sel) add(i, `<b>${code[i]}</b>${X.pillars === 'deg' ? deg[i] : '#' + NET.btwRank[i]}`, X.pillars === 'deg' ? 'amb' : 'grn');
  });
  if (X.path && X.tab === 'path') X.path.forEach(i => add(i, `<b>${code[i]}</b>${esc(city[i])}`, 'mag'));
  if (X.sel >= 0 && !(X.path && X.tab === 'path' && X.path.includes(X.sel))) add(X.sel, `<b>${code[X.sel]}</b>${esc(city[X.sel])}`, 'cyn');
}

// ------------------------------------------------------- globe interaction --
const M4 = new THREE.Matrix4();
function pickAirport(mx, my) {
  const cam = GL.camera, e = M4.multiplyMatrices(cam.projectionMatrix, cam.matrixWorldInverse).elements;
  const { P } = NET, cx = cam.position.x, cy = cam.position.y, cz = cam.position.z, w = window.innerWidth, h = window.innerHeight;
  let best = -1, bd = 196;
  for (let i = 0; i < NET.N; i++) {
    const r = NET.R[i] + GL.attr.aHDeg[i] * XS.deg_h + GL.attr.aHBtw[i] * XS.btw_h;
    const x = P[3 * i] * r, y = P[3 * i + 1] * r, z = P[3 * i + 2] * r;
    const W = e[3] * x + e[7] * y + e[11] * z + e[15];
    const sx = ((e[0] * x + e[4] * y + e[8] * z + e[12]) / W * 0.5 + 0.5) * w, sy = (-(e[1] * x + e[5] * y + e[9] * z + e[13]) / W * 0.5 + 0.5) * h;
    const d2 = (sx - mx) ** 2 + (sy - my) ** 2 - 6 * Math.sqrt(NET.deg[i] / NET.maxDeg) * 14;
    if (d2 < bd) { bd = d2; best = i; }
  }
  return best;
}
function flyTo(lat, lon, dist) {
  const c = orbit.cur;
  orbit.from = c.slice();
  orbit.to = [clamp(lat * 0.85, -70, 75), lon + 360 * Math.round((c[1] - lon) / 360), dist, 0, 0];
  orbit.t0 = performance.now();
}
function orbitStep(now) {
  if (!orbit.to) return;
  const x = smooth((now - orbit.t0) / (orbit.dur * 1000)), f = orbit.from, t = orbit.to;
  orbit.cur = f.map((v, k) => (k === 2 ? Math.exp(Math.log(v) + (Math.log(t[k]) - Math.log(v)) * x) : v + (t[k] - v) * x));
  if (x >= 1) orbit.to = null;
}
function bindCanvas() {
  const cv = GL.canvas, tip = $('#tip'), pts = new Map();
  let down = null, pinch = 0;
  cv.addEventListener('pointerdown', ev => {
    pts.set(ev.pointerId, [ev.clientX, ev.clientY]);
    cv.setPointerCapture(ev.pointerId);
    down = { x: ev.clientX, y: ev.clientY, moved: false };
    if (pts.size === 2) { const [a, b] = [...pts.values()]; pinch = Math.hypot(a[0] - b[0], a[1] - b[1]); }
  });
  cv.addEventListener('pointermove', ev => {
    const explore = APP.mode === 'explore';
    if (pts.has(ev.pointerId) && explore) {
      const p = pts.get(ev.pointerId), dx = ev.clientX - p[0], dy = ev.clientY - p[1];
      pts.set(ev.pointerId, [ev.clientX, ev.clientY]);
      if (pts.size === 2) {
        const [a, b] = [...pts.values()], d = Math.hypot(a[0] - b[0], a[1] - b[1]);
        if (pinch > 0) orbit.cur[2] = clamp(orbit.cur[2] * pinch / d, 0.35, 5);
        pinch = d; down.moved = true; return;
      }
      if (down && Math.hypot(ev.clientX - down.x, ev.clientY - down.y) > 4) down.moved = true;
      if (down && down.moved) {
        const k = 0.2 * (orbit.cur[2] + 0.35) / 3.4;
        orbit.to = null;
        orbit.cur[1] -= dx * k; orbit.cur[0] = clamp(orbit.cur[0] + dy * k, -80, 80);
      }
      tip.style.opacity = 0;
      return;
    }
    if (!explore || ev.pointerType === 'touch') { tip.style.opacity = 0; return; }
    const i = pickAirport(ev.clientX, ev.clientY);
    cv.style.cursor = i >= 0 ? 'pointer' : 'grab';
    if (i >= 0) {
      tip.innerHTML = `<b>${esc(NET.code[i])}</b>${esc(NET.city[i])}, ${NET.deg[i]} partners`;
      tip.style.transform = `translate(${ev.clientX + 14}px, ${ev.clientY + 12}px)`;
      tip.style.opacity = 1;
    } else tip.style.opacity = 0;
  });
  const end = ev => {
    pts.delete(ev.pointerId);
    if (pts.size < 2) pinch = 0;
    if (APP.mode === 'explore' && down && !down.moved && ev.type === 'pointerup') {
      const i = pickAirport(ev.clientX, ev.clientY);
      if (i >= 0) { $('#q').value = NET.code[i]; selectAirport(i); }
    }
    if (!pts.size) down = null;
  };
  cv.addEventListener('pointerup', end);
  cv.addEventListener('pointercancel', end);
  cv.addEventListener('pointerleave', () => { tip.style.opacity = 0; });
  cv.addEventListener('wheel', ev => {
    if (APP.mode !== 'explore') return;
    ev.preventDefault();
    orbit.to = null;
    orbit.cur[2] = clamp(orbit.cur[2] * Math.exp(ev.deltaY * 0.0012), 0.35, 5);
  }, { passive: false });
}

// ================================================================= WEBXR ==
// Headset mode (built for Meta Quest, works in any WebXR browser). The globe
// floats in front of you as an object: the story's camera moves become
// rotations and scaling of the globe, the side panel is redrawn on a canvas you
// point at, and labels become sprites. Controllers: point and pull the trigger
// to click, drag the globe with the trigger or grip, thumbstick spins and zooms,
// A/X plays and pauses the story. Hand tracking: point and pinch.
const XR = {
  on: false, mode: null, session: null, needRecenter: false, fov: false, fontOK: 0, clear: true,
  head: new THREE.Vector3(), headQ: new THREE.Quaternion(), globeOff: new THREE.Vector3(), globeBase: new THREE.Vector3(), camLocal: new THREE.Vector3(0, 0, 5),
  baseR: 0.36, R: 0.36, viewH: 1600, pointK: 0.0028, hlScale: 1.4,
  ctrls: [], panels: [], main: null, foot: null, tip: null, tipI: -1, elInfo: null,
  kbd: { open: false, q: '' }, pf: -1, pt: -1, pick: 'from', aiKey: '', ai: null, ccKey: '', cc: null,
};
const _xd = new THREE.Vector3(), _xp = new THREE.Vector3(), _xq = new THREE.Quaternion();
const _xq2 = new THREE.Quaternion(), _xm = new THREE.Matrix4(), _xinv = new THREE.Matrix4();
const _xa = new THREE.Vector3(), _xb = new THREE.Vector3(), _xc = new THREE.Vector3(), _xz = new THREE.Vector3(0, 0, 1);

// ------------------------------------------------------------ globe pose --
// Turn a story/orbit camera [lat, lon, dist, tilt, heading] into a pose for the
// floating globe: the side the camera looks at faces you, its "up" stays up,
// and zooming in makes the globe bigger.
function xrPlaceGlobe(p) {
  const d = Math.max(p[2], 0.05), pose = cameraPose(p[0], p[1], d, p[3], p[4]);
  _xc.copy(pose.C).normalize();
  _xb.copy(pose.up).addScaledVector(_xc, -pose.up.dot(_xc)).normalize();
  _xa.crossVectors(_xb, _xc);
  _xq.setFromRotationMatrix(_xm.makeBasis(_xa, _xb, _xc).transpose());
  XR.R = XR.baseR * clamp(Math.pow(4.6 / (d + 1), 0.8), 0.72, 2.0);
  // a little right of centre and below eye level, leaving room for the panel on the left
  const dc = Math.max(1.2, XR.R + 0.62), cx = 0.3, cy = -0.2;
  // plus wherever you have moved it with the grip; the story's focus side keeps facing you
  const gx = cx + XR.globeOff.x, gy = cy + XR.globeOff.y, gz = -dc + XR.globeOff.z;
  XR.globeBase.set(cx, cy, -dc);
  _xq2.setFromUnitVectors(_xz, _xa.set(-gx, -gy, -gz).normalize());
  GL.world.position.set(gx, gy, gz);
  GL.world.quaternion.copy(_xq2).multiply(_xq);
  GL.world.scale.setScalar(XR.R);
}
function xrRecenter() {
  XR.globeOff.set(0, 0, 0);
  if (XR.panelGroup) { XR.panelGroup.position.copy(XR.panelHome.p); XR.panelGroup.rotation.set(0, XR.panelHome.yaw, 0); }
  const yaw = new THREE.Euler().setFromQuaternion(XR.headQ, 'YXZ').y;
  GL.rig.position.copy(XR.head);
  GL.rig.quaternion.setFromAxisAngle(new THREE.Vector3(0, 1, 0), yaw);
}

// ---------------------------------------------------------------- labels --
const LBL_STYLE = { '': ['#f2f6fc', null], mag: ['#ffd2f4', '#ff5ad9'], amb: ['#ffe2b0', '#ffb43b'],
  grn: ['#c9ffe3', '#3ee08f'], cyn: ['#d2f6ff', '#46d9ff'], tip: ['#e7eef8', '#46d9ff'] };
function labelSprite(L) {
  if (L.sprite) return L.sprite;
  let bold, rest, cls;
  if (L.txt) [bold, rest, cls] = L.txt;
  else {
    const b = L.el.querySelector('b');
    bold = b ? b.textContent : ''; rest = L.el.textContent.slice(bold.length).trim();
    cls = ['mag', 'amb', 'grn', 'cyn'].find(k => L.el.classList.contains(k)) || '';
  }
  const px = 34, H = 56, pad = 16, gap = bold && rest ? 10 : 0;
  const cv = document.createElement('canvas'), ctx = cv.getContext('2d');
  ctx.font = vfont(px, 700); const wb = bold ? ctx.measureText(bold).width : 0;
  ctx.font = vfont(px); const wr = rest ? ctx.measureText(rest).width : 0;
  cv.width = Math.ceil(pad * 2 + wb + gap + wr); cv.height = H;
  const [col, acc] = LBL_STYLE[cls] || LBL_STYLE[''];
  ctx.save(); rr(ctx, 0, 0, cv.width, H, 8); ctx.clip();
  ctx.fillStyle = cls === 'tip' ? 'rgba(10,19,34,0.97)' : 'rgba(3,8,16,0.82)'; ctx.fillRect(0, 0, cv.width, H);
  if (acc) { ctx.fillStyle = acc; ctx.fillRect(0, 0, 5, H); }
  ctx.restore();
  ctx.textBaseline = 'middle'; ctx.fillStyle = col;
  ctx.font = vfont(px, 700); ctx.fillText(bold, pad, H / 2 + 1);
  ctx.font = vfont(px); ctx.fillText(rest, pad + wb + gap, H / 2 + 1);
  const tex = new THREE.CanvasTexture(cv);
  tex.anisotropy = 4;
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false, depthWrite: false }));
  sp.renderOrder = cls === 'tip' ? 11 : 10;
  sp.userData.aspect = cv.width / H;
  sp.center.set(-0.35 / sp.userData.aspect, 0.5);
  GL.world.add(sp);
  return (L.sprite = sp);
}
function dropSprite(L) {
  const sp = L && L.sprite;
  if (!sp) return;
  if (sp.parent) sp.parent.remove(sp);
  sp.material.map.dispose(); sp.material.dispose();
  L.sprite = null;
}
function placeLabelXR(L, alpha, S) {
  if (alpha <= 0.001) { if (L.sprite) L.sprite.visible = false; return; }
  const sp = labelSprite(L), { P } = NET, i = L.i, cam = XR.camLocal;
  const h = L.h ? GL.attr.aHDeg[i] * S.deg_h + GL.attr.aHBtw[i] * S.btw_h : 0;
  const r = NET.R[i] + h + 0.01, x = P[3 * i] * r, y = P[3 * i + 1] * r, z = P[3 * i + 2] * r;
  const vis = 1; // the cell is see-through
  const o = alpha * vis;
  sp.visible = o > 0.01;
  sp.material.opacity = o;
  sp.position.set(x, y, z);
  const hm = 0.021 / XR.R;
  sp.scale.set(hm * sp.userData.aspect, hm, 1);
}
function xrTip(S) {
  let i = -1;
  if (APP.mode === 'explore') for (const c of XR.ctrls) if (c.hover && c.hover.kind === 'globe' && c.hover.i >= 0) { i = c.hover.i; break; }
  if (i !== XR.tipI) {
    XR.tipI = i;
    if (XR.tip) dropSprite(XR.tip);
    XR.tip = i >= 0 ? { i, h: 'deg', txt: [NET.code[i], `${NET.city[i]}, ${NET.deg[i]} partners`, 'tip'] } : null;
  }
  if (XR.tip) placeLabelXR(XR.tip, 1, S);
}

// ------------------------------------------------------- picking on globe --
// Closest airport to a ray, in globe coordinates (unit sphere). Like the
// screen version, big hubs win ties and airports beyond the horizon are skipped.
function pickAirportRay(o, d) {
  const { P, N, deg, maxDeg } = NET, ah = GL.attr.aHDeg, bh = GL.attr.aHBtw;
  let best = -1, bs = Infinity;
  for (let i = 0; i < N; i++) {
    const px = P[3 * i], py = P[3 * i + 1], pz = P[3 * i + 2];
    const r = NET.R[i] + ah[i] * XS.deg_h + bh[i] * XS.btw_h;
    const vx = px * r - o.x, vy = py * r - o.y, vz = pz * r - o.z, t = vx * d.x + vy * d.y + vz * d.z;
    if (t <= 0) continue;
    const ang = Math.sqrt(Math.max(0, vx * vx + vy * vy + vz * vz - t * t)) / t;
    if (ang > 0.026) continue;
    const sc = ang - 0.008 * Math.sqrt(deg[i] / maxDeg);
    if (sc < bs) { bs = sc; best = i; }
  }
  return best;
}

// ----------------------------------------------------------- controllers --
function xrController(i) {
  const g = GL.renderer.xr.getController(i);
  const c = { i, g, src: null, hover: null, press: null, grab: null, wantPress: false, b4: false, o: new THREE.Vector3(), d: new THREE.Vector3() };
  const geo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 0, -1)]);
  c.ray = new THREE.Line(geo, new THREE.LineBasicMaterial({ color: 0x9fe8ff, transparent: true, opacity: 0.55, depthTest: false, depthWrite: false }));
  c.ray.renderOrder = 60;
  g.add(c.ray);
  const tip = new THREE.Mesh(new THREE.SphereGeometry(0.006, 12, 8), new THREE.MeshBasicMaterial({ color: 0x9fe8ff }));
  g.add(tip);
  c.dot = new THREE.Mesh(new THREE.CircleGeometry(1, 24), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.9, depthTest: false, depthWrite: false }));
  c.dot.renderOrder = 61; c.dot.visible = false;
  GL.scene.add(c.dot);
  g.visible = false;
  g.addEventListener('connected', e => { c.src = e.data; c.ray.visible = e.data.targetRayMode !== 'screen'; });
  g.addEventListener('disconnected', () => { c.src = null; c.press = null; c.grab = null; c.hover = null; c.wantPress = false; c.dot.visible = false; });
  // presses are handled on the next frame, once the ray has its fresh pose
  g.addEventListener('selectstart', () => { c.wantPress = true; });
  g.addEventListener('selectend', () => { if (c.wantPress) { c.wantPress = false; xrPress(c); } xrRelease(c); });
  g.addEventListener('squeezestart', () => xrGrab(c, true));
  g.addEventListener('squeezeend', () => xrGrab(c, false));
  GL.scene.add(g);
  XR.ctrls.push(c);
}
function buzz(c, s, ms) {
  try {
    const a = c.src && c.src.gamepad && c.src.gamepad.hapticActuators;
    if (a && a[0] && a[0].pulse) a[0].pulse(s || 0.3, ms || 18);
  } catch (e) { /* no haptics */ }
}
function rayAngles(c) {
  _xd.copy(c.d).applyQuaternion(_xq.copy(GL.rig.quaternion).invert());
  return [Math.atan2(_xd.x, -_xd.z), Math.asin(clamp(_xd.y, -1, 1))];
}
function startDrag(c) {
  const [az, el] = rayAngles(c), centre = _xp.setFromMatrixPosition(GL.world.matrixWorld);
  return { az, el, az0: az, el0: el, moved: false, k: Math.max(0.6, (c.o.distanceTo(centre) - XR.R) / XR.R) };
}
// dragging moves the globe surface along with the ray (explore mode only)
function dragGlobe(c, st) {
  const [az, el] = rayAngles(c);
  if (!st.moved) {
    if (Math.hypot(az - st.az0, el - st.el0) < 0.025) return;
    st.moved = true;
  }
  let da = az - st.az;
  da -= Math.round(da / (2 * Math.PI)) * 2 * Math.PI;
  const de = el - st.el;
  st.az = az; st.el = el;
  if (APP.mode !== 'explore') return;
  orbit.to = null;
  const kd = st.k / D2R;
  orbit.cur[1] -= da * kd / Math.max(0.3, Math.cos(orbit.cur[0] * D2R));
  orbit.cur[0] = clamp(orbit.cur[0] - de * kd, -80, 80);
}
function xrPress(c) {
  const h = c.hover;
  c.press = null;
  if (!h) return;
  if (h.kind === 'panel') {
    const r = h.P.at(h.x, h.y);
    if (!r) return;
    c.press = { kind: 'panel', P: h.P, id: r.id, r };
    if (r.drag) { r.drag(h.x, h.y); buzz(c, 0.2, 12); }
  } else c.press = Object.assign(startDrag(c), { kind: 'globe', i: h.i });
}
function xrRelease(c) {
  const p = c.press;
  c.press = null;
  if (!p) return;
  if (p.kind === 'panel') {
    if (p.r.drag) return;
    const h = c.hover;
    if (h && h.kind === 'panel' && h.P === p.P) {
      const r = h.P.at(h.x, h.y);
      if (r && r.id === p.id && r.fn) { buzz(c); r.fn(); }
    }
  } else if (!p.moved && p.i >= 0) { buzz(c); xrClickAirport(p.i); }
}
function xrGrab(c, on) {
  c.grab = null;
  const h = c.hover;
  if (!on || !h) return;
  if (XR.stories) return; // the Stories screen stays put
  const obj = h.kind === 'panel' ? XR.panelGroup : GL.world;
  c.grab = { target: h.kind === 'panel' ? 'panel' : 'globe', q0: new THREE.Quaternion().setFromRotationMatrix(c.g.matrix).invert(),
    o0: c.o.clone(), p0: obj.getWorldPosition(new THREE.Vector3()), reach: 1 };
  buzz(c, 0.4, 25);
}
const _gq = new THREE.Quaternion(), _gv = new THREE.Vector3(), _gh = new THREE.Vector3();
// the grabbed object keeps its offset from the controller, so moving or turning your hand carries it
function carry(c, dt) {
  const G = c.grab, gp = c.src.gamepad;
  if (gp && gp.axes.length >= 4 && Math.abs(gp.axes[3]) > 0.2) G.reach = clamp(G.reach * Math.exp(gp.axes[3] * dt * 1.5), 0.15, 6);
  _gq.setFromRotationMatrix(c.g.matrix).multiply(G.q0);
  _gv.copy(G.p0).sub(G.o0).multiplyScalar(G.reach);
  const lenMax = 4;
  if (_gv.length() > lenMax) _gv.setLength(lenMax);
  _gv.applyQuaternion(_gq).add(c.o);
  GL.rig.worldToLocal(_gv);
  if (G.target === 'globe') XR.globeOff.copy(_gv).sub(XR.globeBase);
  else {
    XR.panelGroup.position.copy(_gv);
    GL.rig.worldToLocal(_gh.copy(XR.head));
    XR.panelGroup.rotation.set(0, Math.atan2(_gh.x - _gv.x, _gh.z - _gv.z), 0); // keep it upright, facing you
  }
}
function xrPoint(c, dt) {
  const g = c.g;
  if (!c.src || !g.visible) { c.hover = null; c.dot.visible = false; return; }
  c.o.setFromMatrixPosition(g.matrix);
  c.d.set(0, 0, -1).transformDirection(g.matrix);
  let hit = null, dist = 2.5;
  // panels first: they are drawn on top of everything
  XR.raycaster.set(c.o, c.d);
  const hs = XR.raycaster.intersectObjects(XR.panelMeshes.filter(m => m.visible), false);
  if (hs.length) {
    const h = hs[0], P = XR.panels.find(q => q.mesh === h.object);
    hit = { kind: 'panel', P, x: h.uv.x * P.w, y: (1 - h.uv.y) * P.h, point: h.point };
    dist = h.distance;
  } else if (!XR.stories) {
    const oL = _xa.copy(c.o).applyMatrix4(_xinv), dL = _xb.copy(c.d).transformDirection(_xinv);
    const b = oL.dot(dL), disc = b * b - (oL.lengthSq() - 1.0816);
    const t = disc > 0 ? -b - Math.sqrt(disc) : -1;
    const i = APP.mode === 'explore' ? pickAirportRay(oL, dL) : -1;
    if (t > 0 || i >= 0) {
      if (t > 0) _xp.copy(dL).multiplyScalar(t).add(oL);
      else {
        nodePos(i, GL.attr.aHDeg[i] * XS.deg_h + GL.attr.aHBtw[i] * XS.btw_h, _xp);
      }
      _xp.applyMatrix4(GL.world.matrixWorld);
      hit = { kind: 'globe', i, point: _xp.clone() };
      dist = c.o.distanceTo(_xp);
    }
  }
  c.hover = hit;
  if (c.wantPress) { c.wantPress = false; xrPress(c); }
  if (c.press && c.press.kind === 'globe') dragGlobe(c, c.press);
  if (c.grab) carry(c, dt);
  if (c.press && c.press.kind === 'panel' && c.press.r.drag && hit && hit.kind === 'panel' && hit.P === c.press.P) c.press.r.drag(hit.x, hit.y);
  // thumbstick: spin and zoom the globe; A/X: play or pause the story
  const gp = c.src.gamepad;
  if (gp) {
    const ax = gp.axes.length >= 4 ? gp.axes[2] : 0, ay = gp.axes.length >= 4 ? gp.axes[3] : 0;
    if (APP.mode === 'explore' && !c.press && !c.grab) {
      if (Math.abs(ay) > 0.2) { orbit.to = null; orbit.cur[2] = clamp(orbit.cur[2] * Math.exp(ay * dt * 1.5), 0.9, 5); }
      if (Math.abs(ax) > 0.2) { orbit.to = null; orbit.cur[1] -= ax * dt * 60 * (orbit.cur[2] + 0.35) / 3.4; }
    }
    const b4 = !!(gp.buttons[4] && gp.buttons[4].pressed);
    if (b4 && !c.b4 && APP.mode === 'story') APP.togglePlay();
    c.b4 = b4;
  }
  c.ray.scale.z = dist;
  if (hit) {
    c.dot.visible = true;
    c.dot.position.copy(hit.point);
    c.dot.lookAt(XR.head);
    c.dot.scale.setScalar(0.005 * Math.max(0.3, c.dot.position.distanceTo(XR.head)));
  } else c.dot.visible = false;
}

// ---------------------------------------------------------------- frames --
function xrBegin(frame, dt) {
  const ref = GL.renderer.xr.getReferenceSpace();
  const pose = frame && ref ? frame.getViewerPose(ref) : null;
  if (pose) {
    const p = pose.transform.position, q = pose.transform.orientation;
    XR.head.set(p.x, p.y, p.z); XR.headQ.set(q.x, q.y, q.z, q.w);
    if (XR.needRecenter) { xrRecenter(); XR.needRecenter = false; }
  }
  const bl = XR.session && XR.session.renderState.baseLayer;
  if (bl) {
    if (bl.framebufferHeight) XR.viewH = bl.framebufferHeight;
    if (!XR.fov) {
      XR.fov = true;
      try { if ('fixedFoveation' in bl) bl.fixedFoveation = 0.5; } catch (e) { /* not supported */ }
    }
  }
  GL.rig.updateMatrixWorld(true);
  _xinv.copy(GL.world.matrixWorld).invert();
  for (const c of XR.ctrls) xrPoint(c, dt);
  for (const P of XR.panels) {
    let hv = null;
    for (const c of XR.ctrls) {
      if (c.hover && c.hover.kind === 'panel' && c.hover.P === P) { const r = P.at(c.hover.x, c.hover.y); if (r) hv = r.id; }
    }
    P.hover = hv;
  }
}
function xrUpdate(S) {
  // the Stories screen replaces the story's panels and hides the story
  const land = !!XR.stories;
  if (XR.land) {
    // Sound check takes the place of the story cards while it is open
    for (const P of XR.land) P.mesh.visible = land && (P === XR.land[0] || !XR.soundCheck);
    XR.snd.mesh.visible = land && !!XR.soundCheck;
    XR.main.mesh.visible = XR.foot.mesh.visible = !land;
  }
  GL.world.visible = !land;
  if (land !== XR.landShown) { XR.landShown = land; HOST.setUrl(land); }
  GL.rig.updateMatrixWorld(true);
  XR.camLocal.copy(XR.head);
  GL.world.worldToLocal(XR.camLocal);
  const story = APP.mode === 'story';
  for (const L of ST.labels) {
    if (story) placeLabelXR(L, fadeVal(storyT(APP.t), L.tIn, L.tOut, 0.5), S);
    else if (L.sprite) L.sprite.visible = false;
  }
  for (const L of LBL.extra) {
    if (!story) placeLabelXR(L, 1, S);
    else if (L.sprite) L.sprite.visible = false;
  }
  xrTip(S);
  const now = performance.now();
  for (const P of XR.panels) panelTick(P, now);
}

// ---------------------------------------------------------- explore glue --
function xrClickAirport(i) {
  if (APP.mode !== 'explore') return;
  XR.kbd.open = false;
  if (X.tab === 'path') { xrSetPathEnd(i); return; }
  $('#q').value = NET.code[i];
  selectAirport(i);
}
// in the Paths tab, globe clicks fill the highlighted end (From, then To)
function xrSetPathEnd(i) {
  if (XR.pick === 'to') { XR.pt = i; $('#pt').value = NET.code[i]; }
  else { XR.pf = i; $('#pf').value = NET.code[i]; XR.pick = 'to'; }
  if (XR.pf >= 0 && XR.pt >= 0) runPath(XR.pf, XR.pt);
}
function xrPathPreset(s, t) {
  XR.pf = s; XR.pt = t; XR.pick = 'to';
  $('#pf').value = NET.code[s]; $('#pt').value = NET.code[t];
  runPath(s, t);
}
function xrClearPath() {
  X.path = null; X.pathErr = null; X.count = 0;
  setPathAttribute(null); setHighlight('xpath', null);
  renderPathResult(); updateExtraLabels();
}
function xrPickSuggestion(i) {
  XR.kbd.open = false; XR.kbd.q = '';
  if (X.tab === 'path') xrSetPathEnd(i);
  else { $('#q').value = NET.code[i]; showTab('airport'); selectAirport(i); }
}
function xrZoom(f) {
  const c = orbit.cur;
  orbit.from = c.slice();
  orbit.to = [c[0], c[1], clamp(c[2] * f, 0.9, 5), c[3], c[4]];
  orbit.t0 = performance.now();
}
function xrSetK(k) {
  k = clamp(Math.round(k), 0, 60);
  if (k === X.closeK) return;
  X.closeK = k; $('#kslider').value = k;
  updateClosures();
}
function airportInfo(i) {
  const k = i + '|' + X.closeK + X.closeMode + [...X.manual].join(',');
  if (XR.aiKey === k) return XR.ai;
  const { deg } = NET, { dist, order, n } = bfs(i, anyRemoved() ? removed : null);
  let sum = 0, far = i;
  for (let q = 1; q < n; q++) { const v = order[q]; sum += dist[v]; if (dist[v] > dist[far] || (dist[v] === dist[far] && deg[v] > deg[far])) far = v; }
  const nb = Array.from(NET.adj.slice(NET.adjS[i], NET.adjS[i + 1])).sort((a, b) => deg[b] - deg[a]);
  XR.aiKey = k; XR.ai = { n, sum, far, farD: dist[far], nb };
  return XR.ai;
}
function closureInfo() {
  const k = X.closeK + X.closeMode + [...X.manual].join(',');
  if (XR.ccKey !== k) { XR.ccKey = k; XR.cc = connectivity(removed); }
  return XR.cc;
}
function rebuildHighlights(scale) {
  GL.hlScale = scale;
  for (const k of Object.keys(GL.highlights)) {
    const m = GL.highlights[k], [pairs, color, opts] = m.userData.args, u = m.material.uniforms;
    const prog = u.uProg.value, alpha = u.uAlpha.value, vis = m.visible;
    const n = setHighlight(k, pairs, color, opts);
    if (n) { n.material.uniforms.uProg.value = prog; n.material.uniforms.uAlpha.value = alpha; n.visible = vis; }
  }
}

// --------------------------------------------------------------- session --
function xrMsg(text) {
  const el = $('#xrmsg');
  el.textContent = text; el.style.display = 'block';
  clearTimeout(xrMsg.t);
  xrMsg.t = setTimeout(() => { el.style.display = 'none'; }, 6000);
}
async function xrStart(mode) {
  if (XR.session || !navigator.xr) return;
  let session;
  try {
    session = await navigator.xr.requestSession(mode, { optionalFeatures: ['local-floor', 'hand-tracking'] });
  } catch (err) {
    HOST.landingVR = false;
    xrMsg(`Could not start ${mode === 'immersive-ar' ? 'AR' : 'VR'}: ${err && err.message ? err.message : err}`);
    return;
  }
  XR.session = session; XR.mode = mode;
  HOST.session = session; HOST.mode = mode;
  session.addEventListener('visibilitychange', xrVisibility);
  xrEnterScene();
  try {
    GL.renderer.xr.setReferenceSpaceType('local');
    await GL.renderer.xr.setSession(session);
    const ref = GL.renderer.xr.getReferenceSpace();
    if (ref && ref.addEventListener) ref.addEventListener('reset', () => { XR.needRecenter = true; });
  } catch (err) {
    console.error(err);
    xrMsg('Could not start the headset view: ' + (err && err.message ? err.message : err));
    try { await session.end(); } catch (e) { /* already ended */ }
    if (XR.on) xrEnded();
  }
}
function xrEnterScene() {
  XR.stories = false;
  XR.on = true; XR.needRecenter = true; XR.fov = false; XR.tipI = -1;
  document.body.classList.add('xr');
  GL.rig.position.set(0, 0, 0); GL.rig.quaternion.identity();
  XR.clear = !(XR.session.environmentBlendMode && XR.session.environmentBlendMode !== 'opaque') && XR.mode !== 'immersive-ar';
  applyTheme();
  GL.stars.visible = XR.clear;
  GL.stars.material.size = 2.2;
  for (const P of XR.panels) { P.mesh.visible = true; P.last = ''; }
  XR.kbd.open = false;
  if (X.pathEnds) { XR.pf = X.pathEnds[0]; XR.pt = X.pathEnds[1]; }
  // every headset session starts the story from the top; entered from the start screen, it shows the Stories menu first
  const fromStart = HOST.picking || HOST.landingVR;
  HOST.landingVR = false;
  HOST.closePicker();
  if (fromStart) { APP.enterStory(0); APP.playing = false; XR.stories = true; XR.inStory = false; audioSync(); }
  else { XR.inStory = true; if (APP.mode === 'story') APP.playing = true; } // already in a story: carry on where you were
  $('#tip').style.opacity = 0;
  rebuildHighlights(XR.hlScale);
  if (document.fonts && !XR.fontOK) {
    Promise.all([document.fonts.load(vfont(30, 700)), document.fonts.load(vfont(30))]).then(() => {
      XR.fontOK = 1;
      [...ST.labels, ...LBL.extra].forEach(dropSprite);
    }).catch(() => {});
  }
}
// Headset taken off (or put to sleep) for more than a few seconds: treat the next
// wearer as a new visitor. Restart the story and place everything in front of them.
const XR_AWAY_MS = 3000;
function xrVisibility() {
  const v = XR.session && XR.session.visibilityState;
  if (v === 'hidden') { if (!XR.hiddenAt) XR.hiddenAt = performance.now(); }
  else if (v === 'visible' && XR.hiddenAt) {
    const away = performance.now() - XR.hiddenAt;
    XR.hiddenAt = 0;
    if (away > XR_AWAY_MS) xrFreshStart();
  }
  audioSync();
}
function xrFreshStart() {
  XR.kbd.open = false; XR.kbd.q = '';
  for (const c of XR.ctrls) { c.press = null; c.grab = null; c.wantPress = false; }
  APP.enterStory(0); APP.playing = false; audioSync();
  XR.stories = true; XR.inStory = false; // a new wearer lands in the Stories screen
  XR.needRecenter = true; // uses the new wearer's head position and direction on the next frame
  lastNow = 0;
}
// a story picked inside the headset takes over the running session
function xrAdopt() {
  XR.session = HOST.session; XR.mode = HOST.mode;
  XR.session.addEventListener('visibilitychange', xrVisibility);
  XR.ctrls.forEach((c, i) => { const s = HOST.inputs[i]; if (s) { c.src = s; c.ray.visible = s.targetRayMode !== 'screen'; } });
  xrEnterScene();
  // keep the cell and the panel where they were in the story before
  const p = HOST.xrPose;
  if (p) {
    XR.needRecenter = false;
    GL.rig.position.copy(p.rp); GL.rig.quaternion.copy(p.rq);
    XR.globeOff.copy(p.off);
    XR.panelGroup.position.copy(p.pp); XR.panelGroup.rotation.set(0, p.pr, 0);
  }
  const ref = GL.renderer.xr.getReferenceSpace();
  if (ref && ref.addEventListener) ref.addEventListener('reset', () => { XR.needRecenter = true; });
}
function xrEnded() {
  if (!XR.on) return;
  XR.on = false; XR.session = null; XR.mode = null; XR.hiddenAt = 0;
  HOST.session = null;
  document.body.classList.remove('xr');
  GL.rig.position.set(0, 0, 0); GL.rig.quaternion.identity();
  GL.world.position.set(0, 0, 0); GL.world.quaternion.identity(); GL.world.scale.setScalar(1);
  for (const P of XR.panels) P.mesh.visible = false;
  for (const c of XR.ctrls) { c.g.visible = false; c.dot.visible = false; c.press = null; c.grab = null; c.hover = null; c.src = null; }
  for (const L of [...ST.labels, ...LBL.extra]) { if (L.sprite) L.sprite.visible = false; L.o = -1; }
  if (XR.tip) dropSprite(XR.tip);
  XR.tip = null; XR.tipI = -1;
  XR.clear = true;
  GL.stars.visible = true; GL.stars.material.size = 1.3;
  GL.U.uPx.value = 0;
  GL.world.visible = true;
  for (const P of XR.land || []) P.mesh.visible = false;
  if (XR.snd) XR.snd.mesh.visible = false;
  // left the headset from the Stories screen: back to the Stories screen on the page
  if (XR.stories) { XR.stories = false; HOST.openPicker(); }
  applyTheme();
  rebuildHighlights(1);
  resize();
}
function xrSetup() {
  XR.raycaster = new THREE.Raycaster();
  // panel 0.62 m wide, about 40 degrees to the left and facing you
  const mw = 0.62, px = -0.56, py = 0.04, pz = -0.86, yaw = Math.atan2(-px, -pz);
  XR.main = makePanel(1024, 1200, mw, drawMain, sigMain);
  XR.foot = makePanel(1024, 176, mw, drawFoot, sigFoot);
  XR.panelGroup = new THREE.Group();
  XR.panelHome = { p: new THREE.Vector3(px, py, pz), yaw };
  XR.panelGroup.position.copy(XR.panelHome.p); XR.panelGroup.rotation.y = yaw;
  GL.rig.add(XR.panelGroup);
  XR.foot.mesh.position.set(0, -(mw * 1200 / 1024) / 2 - 0.012 - (mw * 176 / 1024) / 2, 0);
  for (const P of [XR.main, XR.foot]) { XR.panelGroup.add(P.mesh); XR.panels.push(P); }
  XR.panelMeshes = XR.panels.map(P => P.mesh);
  xrLandingSetup();
  for (let i = 0; i < 2; i++) xrController(i);
  GL.renderer.xr.addEventListener('sessionend', xrEnded);
  $('#btnVR').addEventListener('click', () => xrStart('immersive-vr'));
  $('#btnAR').addEventListener('click', () => xrStart('immersive-ar'));
  if (!navigator.xr) {
    if (/OculusBrowser|Quest|Pico|Wolvic/i.test(navigator.userAgent)) xrMsg('Open this page over https:// to view it in VR.');
    return;
  }
  navigator.xr.isSessionSupported('immersive-vr').then(vr => {
    if (vr) $('#btnVR').hidden = false;
    // headsets support both; phones only AR, which this layout is not made for
    return navigator.xr.isSessionSupported('immersive-ar').then(ar => { if (ar && vr) $('#btnAR').hidden = false; });
  }).catch(() => {});
}

// ------------------------------------------------------------ VR panels --
// The HTML side panel can't be shown inside a headset, so it is redrawn on a
// canvas texture. Each draw records clickable regions for the controller ray.
const VC = { bg: 'rgba(8,15,28,0.95)', ink: '#e7eef8', muted: '#95a6bd', faint: '#6c7d94', line: 'rgba(149,166,189,0.22)',
  chip: 'rgba(149,166,189,0.13)', chipHi: 'rgba(149,166,189,0.30)', on: 'rgba(70,217,255,0.20)', cyan: '#46d9ff',
  magenta: '#ff5ad9', amber: '#ffb43b', red: '#ff5a4b', green: '#3ee08f' };
const vfont = (px, w) => `${w || 400} ${px}px B612, "Segoe UI", "Helvetica Neue", Arial, sans-serif`;
const cssColor = s => { const m = /var\(--(\w+)\)/.exec(s || ''); return m ? VC[m[1]] || VC.ink : s || VC.ink; };
function rr(ctx, x, y, w, h, r) {
  r = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
function wrapLines(ctx, text, maxW) {
  const words = String(text).split(/\s+/).filter(Boolean), lines = [];
  let cur = '';
  for (const w of words) {
    const t = cur ? cur + ' ' + w : w;
    if (cur && ctx.measureText(t).width > maxW) { lines.push(cur); cur = w; } else cur = t;
  }
  if (cur) lines.push(cur);
  return lines;
}
// draws wrapped text (textBaseline top), returns its height
function textBlock(ctx, text, x, y, maxW, px, lh, color, weight, maxLines) {
  ctx.font = vfont(px, weight);
  ctx.fillStyle = color || VC.ink;
  let L = wrapLines(ctx, text, maxW);
  if (maxLines && L.length > maxLines) { L = L.slice(0, maxLines); L[maxLines - 1] += '…'; }
  L.forEach((l, k) => ctx.fillText(l, x, y + k * lh));
  return L.length * lh;
}
function fitText(ctx, text, maxW) {
  if (ctx.measureText(text).width <= maxW) return text;
  let t = text;
  while (t.length > 1 && ctx.measureText(t + '…').width > maxW) t = t.slice(0, -1);
  return t + '…';
}
function vButton(ctx, P, id, x, y, w, h, label, fn, o = {}) {
  const hov = P.hover === id;
  rr(ctx, x, y, w, h, o.r !== undefined ? o.r : 10);
  ctx.fillStyle = o.primary ? (hov ? '#8ce9ff' : VC.cyan) : o.on ? VC.on : hov ? VC.chipHi : VC.chip;
  ctx.fill();
  if (o.on || (hov && !o.primary)) { ctx.lineWidth = 2; ctx.strokeStyle = o.on ? VC.cyan : 'rgba(149,166,189,0.55)'; ctx.stroke(); }
  if (label) {
    ctx.font = vfont(o.px || 25, o.bold || o.on || o.primary ? 700 : 400);
    ctx.fillStyle = o.primary ? '#04131c' : o.color || VC.ink;
    ctx.textBaseline = 'middle';
    if (o.left) ctx.fillText(fitText(ctx, label, w - 28), x + 16, y + h / 2 + 1);
    else { ctx.textAlign = 'center'; ctx.fillText(fitText(ctx, label, w - 16), x + w / 2, y + h / 2 + 1); ctx.textAlign = 'left'; }
    ctx.textBaseline = 'top';
  }
  if (fn) P.regions.push({ id, x, y, w, h, fn });
}
function swatch(ctx, x, y, s, color) { rr(ctx, x, y, s, s, 4); ctx.fillStyle = color; ctx.fill(); }
function makePanel(w, h, mw, draw, sig) {
  const cv = document.createElement('canvas');
  cv.width = w; cv.height = h;
  const tex = new THREE.CanvasTexture(cv);
  tex.anisotropy = Math.min(8, GL.renderer.capabilities.getMaxAnisotropy());
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(mw, mw * h / w),
    new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthTest: false, depthWrite: false }));
  mesh.renderOrder = 50;
  mesh.visible = false;
  const P = { w, h, cv, ctx: cv.getContext('2d'), tex, mesh, draw, sig, regions: [], hover: null, last: '', t: 0 };
  P.at = (x, y) => {
    for (let k = P.regions.length - 1; k >= 0; k--) {
      const r = P.regions[k];
      if (x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h) return r;
    }
    return null;
  };
  return P;
}
// redraw only when what the panel shows has changed (texture uploads are not free)
function panelTick(P, now) {
  const s = P.sig() + '|' + P.hover + '|' + XR.fontOK;
  if (s === P.last || now - P.t < 60) return;
  P.last = s; P.t = now;
  const ctx = P.ctx;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, P.w, P.h);
  ctx.globalAlpha = 1; ctx.textBaseline = 'top'; ctx.textAlign = 'left';
  P.regions = [];
  rr(ctx, 0, 0, P.w, P.h, 26);
  ctx.fillStyle = XR.clear ? VC.bg : 'rgba(8,15,28,0.97)';
  ctx.fill();
  P.draw(ctx, P);
  P.tex.needsUpdate = true;
}

// ------------------------------------------------------------ main panel --
function sigMain() {
  if (XR.stories) return 'stories' + audioLabel();
  if (APP.mode === 'story') {
    const it = ST.items.find(x => x.ch === curCh);
    let s = 's' + audioLabel() + (curCh ? curCh.key : '');
    if (it) {
      for (const e of it.els) s += Math.round(Math.max(0, e.o) * 3);
      for (const g of it.grow) s += Math.round(Math.max(0, g.s) * 6);
      if (curCh.key === 'title') s += $('#titleArc').getAttribute('stroke-dashoffset').slice(0, 3) + $('#titleDot').getAttribute('opacity').slice(0, 3);
      if (curCh.key === 'paths') s += $('#flights').textContent;
      if (curCh.key === 'robustness') s += $('#robPct').textContent + $('#robPct').className;
    }
    return s;
  }
  return ['x', audioLabel(), X.tab, X.sel, X.path ? X.path.join(',') : '', X.pathErr || '', X.color, X.pillars, X.iso, X.closeMode,
    X.closeK, [...X.manual].join(','), X.hubsBy, XR.kbd.open, XR.kbd.q, XR.pf, XR.pt, XR.pick, X.curve ? 1 : 0].join('|');
}
const XR_HERE = 'proteins';
const XR_STORIES = HOST.list;
// ------------------------------------------------------- headset landing --
// The Stories screen in the headset: a title panel and one card per story,
// floating in an arc in front of you while the story itself is hidden.
function xrLandingSetup() {
  XR.land = [];
  XR.landGroup = new THREE.Group();
  GL.rig.add(XR.landGroup);
  const head = makePanel(1400, 300, 1.02, drawLandHead, () => 'h' + XR.inStory + audioLabel() + HOST.repeat + XR.soundCheck + HOST.audio.muted);
  head.mesh.position.set(0, 0.36, -1.12);
  XR.landGroup.add(head.mesh); XR.land.push(head);
  HOST.list.forEach((s, k) => {
    const a = (k - (HOST.list.length - 1) / 2) * 0.42, d = 1.06;
    const P = makePanel(640, 820, 0.4, (ctx, P) => drawLandCard(ctx, P, s), () => 'c' + XR.inStory + s.key);
    P.mesh.position.set(Math.sin(a) * d, -0.13, -Math.cos(a) * d);
    P.mesh.rotation.y = -a;
    XR.landGroup.add(P.mesh); XR.land.push(P);
  });
  for (const P of XR.land) XR.panels.push(P);
  // Sound check (opened from the header), in the place of the story cards
  XR.snd = makePanel(1400, 860, 1.02, drawSoundCheck, () => 'snd' + Math.floor(performance.now() / 500));
  XR.snd.mesh.position.set(0, -0.17, -1.1);
  XR.landGroup.add(XR.snd.mesh); XR.panels.push(XR.snd);
  XR.panelMeshes = XR.panels.map(P => P.mesh);
}
// leave the Stories screen: back into this story (resumed, or started if it never ran)
function xrLandingClose() {
  XR.stories = false;
  if (!XR.inStory) APP.enterStory(0);
  XR.inStory = true;
  if (APP.mode === 'story') APP.playing = true;
}
function drawLandHead(ctx, P) {
  ctx.font = vfont(58, 700); ctx.fillStyle = VC.ink; ctx.fillText('Networks, in four stories', 48, 44);
  textBlock(ctx, 'The same ideas, very different networks. Point at a story and pull the trigger (or pinch).', 48, 128, 860, 27, 38, VC.muted, 400, 2);
  // the sound, before a story starts: its state (press to start it, or to turn the narration off and on) and Sound check
  const sl = audioLabel() || (HOST.audio.muted ? 'Sound off' : 'Sound');
  vButton(ctx, P, 'land:sound', 48, 212, 300, 64, sl, () => audioToggle(), { on: sl === 'Sound on', px: 25 });
  vButton(ctx, P, 'land:check', 362, 212, 250, 64, 'Sound check', () => { XR.soundCheck = !XR.soundCheck; }, { on: !!XR.soundCheck, px: 25 });
  let x = P.w - 44;
  const hb = (id, label, fn, w, o) => { x -= w; vButton(ctx, P, id, x, 40, w, 64, label, fn, o); x -= 14; };
  hb('exit', 'Exit', () => { if (XR.session) XR.session.end(); }, 110, { px: 27 });
  hb('recenter', 'Recenter', () => { XR.needRecenter = true; }, 170, { px: 27 });
  if (XR.inStory) vButton(ctx, P, 'back', P.w - 44 - 294, 128, 294, 64, 'Back to the story', xrLandingClose, { px: 26 });
  // Repeat: all stories one after another, or the one you pick again and again (pressing a lit one turns it off)
  vButton(ctx, P, 'rep:all', P.w - 44 - 414, 212, 200, 64, 'Repeat all', () => HOST.toggleRepeat('all'), { on: HOST.repeat === 'all', px: 26 });
  vButton(ctx, P, 'rep:one', P.w - 44 - 200, 212, 200, 64, 'Repeat one', () => HOST.toggleRepeat('one'), { on: HOST.repeat === 'one', px: 26 });
}
// Sound check in the headset: test beeps through each engine, the engine choice, and what is going on
function drawSoundCheck(ctx, P) {
  const x = 48, W = P.w - 96;
  ctx.font = vfont(46, 700); ctx.fillStyle = VC.ink; ctx.fillText('Sound check', x, 36);
  vButton(ctx, P, 'snd:close', P.w - 44 - 160, 30, 160, 60, 'Close', () => { XR.soundCheck = false; }, { px: 25 });
  let y = 100 + textBlock(ctx, 'No narration? Press both beeps. If you hear only one, choose that way to play.', x, 100, W, 27, 37, VC.muted, 400, 2) + 14;
  const bw = (W - 16) / 2, cw = (W - 48) / 4, p = HOST.audio.pref;
  vButton(ctx, P, 'snd:beepW', x, y, bw, 70, 'Beep through Web Audio', () => HOST.audio.beep('webaudio'), { px: 26 });
  vButton(ctx, P, 'snd:beepM', x + bw + 16, y, bw, 70, 'Beep through an audio element', () => HOST.audio.beep('media'), { px: 26 });
  y += 86;
  [['auto', 'Automatic'], ['webaudio', 'Web Audio'], ['media', 'Audio element']].forEach(([k, l], i) =>
    vButton(ctx, P, 'snd:' + k, x + i * (cw + 16), y, cw, 62, l, () => HOST.audio.setEngine(k), { on: p === k, px: 24 }));
  vButton(ctx, P, 'snd:reset', x + 3 * (cw + 16), y, cw, 62, 'Reset', () => HOST.audio.reset(), { px: 24 });
  y += 84;
  for (const line of HOST.audio.report()) {
    if (y > P.h - 44) break;
    y += textBlock(ctx, line, x, y, W, 22, 30, VC.muted, 400, 2) + 4;
  }
}
function drawLandCard(ctx, P, s) {
  const here = s.key === XR_HERE, id = 'card', hov = P.hover === id;
  rr(ctx, 8, 8, P.w - 16, P.h - 16, 22);
  ctx.lineWidth = 4; ctx.strokeStyle = hov ? s.col : here && XR.inStory ? 'rgba(70,217,255,0.6)' : 'rgba(140,170,210,0.3)'; ctx.stroke();
  ctx.fillStyle = s.col; ctx.fillRect(8, 8, P.w - 16, 10);
  ctx.font = vfont(28, 700); ctx.fillStyle = s.col; ctx.fillText(s.kick.toUpperCase(), 48, 64);
  ctx.font = vfont(72, 700); ctx.fillStyle = VC.ink; ctx.fillText(s.title, 46, 112);
  textBlock(ctx, s.desc, 48, 222, P.w - 96, 31, 45, VC.muted, 400, 7);
  ctx.font = vfont(26); ctx.fillStyle = VC.faint; ctx.fillText(s.len, 48, P.h - 196);
  const label = here && XR.inStory ? 'Resume' : 'Start';
  vButton(ctx, P, 'go', 48, P.h - 140, P.w - 96, 92, label, null, { primary: true, px: 34 });
  P.regions.push({ id, x: 0, y: 0, w: P.w, h: P.h, fn: () => (here ? xrLandingClose() : HOST.go(s.key)) });
}
function drawStoriesPane(ctx, P, x, y, W) {
  y += textBlock(ctx, 'Choose a story', x, y, W, 46, 54, VC.ink, 700) + 6;
  y += textBlock(ctx, 'The same ideas, very different networks. Pick one; you stay in the headset view.', x, y, W, 25, 35, VC.muted) + 22;
  // fit the cards above the Back button (the list grew to four)
  const h = Math.min(210, Math.floor((P.h - 96 - y) / XR_STORIES.length) - 18);
  for (const { key: k, kick, title, desc, col } of XR_STORIES) {
    const here = k === XR_HERE;
    vButton(ctx, P, 'story:' + k, x, y, W, h, '', () => { if (here) XR.stories = false; else HOST.go(k); }, { on: here, r: 14 });
    ctx.font = vfont(21, 700); ctx.fillStyle = col; ctx.fillText(kick.toUpperCase(), x + 26, y + 22);
    ctx.font = vfont(38, 700); ctx.fillStyle = VC.ink; ctx.fillText(title, x + 26, y + 54);
    if (here) { ctx.font = vfont(22); ctx.fillStyle = VC.cyan; ctx.textAlign = 'right'; ctx.fillText('You are here', x + W - 26, y + 26); ctx.textAlign = 'left'; }
    textBlock(ctx, desc, x + 26, y + 100, W - 52, 24, 33, VC.muted, 400, 2);
    y += h + 18;
  }
  vButton(ctx, P, 'story:close', x, y + 4, 220, 60, 'Back', () => { XR.stories = false; }, { px: 25 });
}
function drawMain(ctx, P) {
  const story = APP.mode === 'story';
  let x = P.w - 36;
  const hb = (id, label, fn, w, o) => { x -= w; vButton(ctx, P, id, x, 26, w, 54, label, fn, o); x -= 12; };
  hb('exit', 'Exit', () => { if (XR.session) XR.session.end(); }, 96);
  if (AUD && AUD.state !== 'none') hb('sound', audioLabel(), () => audioToggle(), 180, { on: AUD.on(), px: 23 });
  hb('recenter', 'Recenter', () => { XR.needRecenter = true; }, 140);
  hb('stories', 'Stories', () => { XR.stories = true; XR.kbd.open = false; APP.playing = false; }, 130);
  if (!XR.stories) hb('mode', story ? 'Explore now' : 'Replay story', () => (story ? APP.enterExplore() : APP.enterStory(0)), 186, { primary: story });
  ctx.font = vfont(30, 700); ctx.fillStyle = VC.ink;
  ctx.fillText(fitText(ctx, 'Network medicine', x - 40), 40, 36);
  ctx.fillStyle = VC.line; ctx.fillRect(36, 104, P.w - 72, 2);
  if (XR.stories) drawStoriesPane(ctx, P, 44, 136, P.w - 88);
  else if (story) {
    drawStoryPane(ctx, P, 44, 136, P.w - 88);
    ctx.fillStyle = VC.line; ctx.fillRect(36, P.h - 96, P.w - 72, 2);
    textBlock(ctx, 'Trigger (or pinch): use buttons. Grip: move the cell or this panel. A or X: play and pause.', 44, P.h - 74, P.w - 88, 22, 30, VC.faint);
  } else drawExplorePane(ctx, P, 40, 120, P.w - 80);
}

// story: draw the current chapter straight from its HTML, with the same timing
const STY = {
  H1: { px: 84, lh: 90, w: 700, mb: 22 }, H2: { px: 62, lh: 70, w: 700, mb: 24 },
  p: { px: 35, lh: 50, mb: 20, c: 'ink' }, lede: { px: 39, lh: 52, mb: 24, c: 'muted' }, note: { px: 29, lh: 41, mb: 16, c: 'muted' },
  caption: { px: 25, lh: 34, mb: 12, c: 'muted' }, credits: { px: 24, lh: 34, mb: 12, c: 'muted' }, step: { px: 25, lh: 34, mb: 8, c: 'faint' },
};
function storyOpacity(el) {
  if (!XR.elInfo) { XR.elInfo = new Map(); ST.items.forEach(it => it.els.forEach(e => XR.elInfo.set(e.el, e))); }
  const e = XR.elInfo.get(el);
  return e ? Math.round(Math.max(0, e.o) * 3) / 3 : 1;
}
function drawStoryPane(ctx, P, x, y, W) {
  const it = ST.items.find(i => i.ch === curCh) || ST.items[0];
  for (const el of it.sec.children) y = drawStoryEl(ctx, P, el, x, y, W, 1);
  ctx.globalAlpha = 1;
}
function drawStoryEl(ctx, P, el, x, y, W, pa) {
  const a = pa * storyOpacity(el), tag = el.tagName.toUpperCase(), cl = el.classList;
  ctx.globalAlpha = a;
  let h = 0;
  if (tag === 'SVG') {
    // the title's route arc, drawn as it grows
    const k = 1.5, arc = el.querySelector('#titleArc'), dot = el.querySelector('#titleDot');
    const prog = arc ? clamp(1 - parseFloat(arc.getAttribute('stroke-dashoffset') || '1'), 0, 1) : 1;
    const dA = dot ? parseFloat(dot.getAttribute('opacity') || '0') : 1;
    const p0 = [x + 8 * k, y + 36 * k], c1 = [x + 180 * k, y - 16 * k], p1 = [x + 352 * k, y + 36 * k];
    const bz = (s, j) => (1 - s) * (1 - s) * p0[j] + 2 * (1 - s) * s * c1[j] + s * s * p1[j];
    ctx.strokeStyle = VC.magenta; ctx.lineWidth = 3.3; ctx.lineCap = 'round';
    if (prog > 0.002) {
      ctx.beginPath(); ctx.moveTo(p0[0], p0[1]);
      for (let n = 1; n <= 48; n++) { const s = prog * n / 48; ctx.lineTo(bz(s, 0), bz(s, 1)); }
      ctx.stroke();
    }
    ctx.fillStyle = VC.magenta;
    ctx.beginPath(); ctx.arc(p0[0], p0[1], 4.5 * k, 0, 7); ctx.fill();
    ctx.globalAlpha = a * Math.round(dA * 4) / 4;
    ctx.beginPath(); ctx.arc(p1[0], p1[1], 4.5 * k, 0, 7); ctx.fill();
    h = 44 * k + 8;
  } else if (tag === 'H1' || tag === 'H2') {
    const s = STY[tag];
    h = textBlock(ctx, el.textContent, x, y, W, s.px, s.lh, VC.ink, s.w) + s.mb;
  } else if (tag === 'P') {
    const btn = el.querySelector('button');
    if (btn) {
      if (a > 0.3) vButton(ctx, P, 'goExplore', x, y, 380, 68, btn.textContent, () => APP.enterExplore(), { primary: true, px: 27 });
      h = 68 + 22;
    } else {
      const s = cl.contains('lede') ? STY.lede : cl.contains('note') ? STY.note : cl.contains('caption') ? STY.caption
        : cl.contains('credits') ? STY.credits : cl.contains('step') ? STY.step : STY.p;
      const col = ['amber', 'magenta', 'green', 'red', 'cyan'].find(c => cl.contains(c));
      h = textBlock(ctx, el.textContent, x, y, W, s.px, s.lh, col ? VC[col] : VC[s.c], s.w) + s.mb;
    }
  } else if (cl.contains('big')) {
    const col = ['magenta', 'cyan', 'green', 'amber', 'red'].find(c => cl.contains(c));
    const small = el.querySelector('small'), all = el.textContent;
    const main = (small ? all.slice(0, all.length - small.textContent.length) : all).trim();
    ctx.font = vfont(96, 700); ctx.fillStyle = col ? VC[col] : VC.ink;
    ctx.fillText(main, x, y + 2);
    if (small) { const w = ctx.measureText(main).width; ctx.font = vfont(32); ctx.fillStyle = VC.muted; ctx.fillText(small.textContent, x + w + 16, y + 52); }
    h = 112;
  } else if (cl.contains('bars')) {
    const bars = [...el.children], n = bars.length, gap = 8, bw = (W - gap * (n - 1)) / n, top = y + 28, bh = 150;
    bars.forEach((b, k) => {
      const v = b.querySelector('.v'), f = b.querySelector('.fill'), kk = b.querySelector('.k');
      const hp = parseFloat(f.style.height) || 0, m = /scaleY\(([\d.]+)\)/.exec(f.style.transform || '');
      const s = m ? Math.round(parseFloat(m[1]) * 6) / 6 : 1, full = bh * hp / 100, bx = x + k * (bw + gap);
      ctx.fillStyle = cssColor(f.style.background || f.style.backgroundColor);
      if (s > 0) ctx.fillRect(bx, top + bh - full * s, bw, full * s);
      ctx.font = vfont(21); ctx.textAlign = 'center';
      ctx.fillStyle = VC.ink;
      if (v && v.textContent) ctx.fillText(v.textContent, bx + bw / 2, top + bh - full - 24);
      ctx.fillStyle = b.classList.contains('hl') ? VC.ink : VC.muted;
      if (kk) ctx.fillText(kk.textContent, bx + bw / 2, top + bh + 8);
      ctx.textAlign = 'left';
    });
    h = 28 + bh + 44;
  } else if (tag === 'UL' && cl.contains('legend')) {
    let yy = y;
    for (const li of el.children) {
      ctx.globalAlpha = a * storyOpacity(li);
      const sw = li.querySelector('.sw');
      swatch(ctx, x, yy + 10, 24, sw ? cssColor(sw.style.background) : VC.ink);
      ctx.font = vfont(30); ctx.fillStyle = VC.ink;
      ctx.fillText(li.textContent.trim(), x + 40, yy + 5);
      yy += 46;
    }
    h = yy - y + 12;
  } else if (tag === 'UL' && cl.contains('concepts')) {
    let cx = x, cy = y;
    ctx.font = vfont(27);
    for (const li of el.children) {
      const t = li.textContent, w = ctx.measureText(t).width + 28;
      if (cx + w > x + W) { cx = x; cy += 54; }
      rr(ctx, cx, cy, w, 46, 6); ctx.fillStyle = VC.chip; ctx.fill();
      ctx.fillStyle = VC.ink; ctx.fillText(t, cx + 14, cy + 9);
      cx += w + 9;
    }
    h = cy - y + 46 + 26;
  } else if (tag === 'DIV') {
    // a grid of overlapping paragraphs (one fades out as the next fades in)
    let mh = 0;
    for (const c of el.children) mh = Math.max(mh, drawStoryEl(ctx, P, c, x, y, W, a) - y);
    h = mh;
  } else if (el.textContent.trim()) {
    h = textBlock(ctx, el.textContent, x, y, W, 26, 38, VC.ink) + 14;
  }
  ctx.globalAlpha = 1;
  return y + h;
}

// explore: tabs and panes mirroring the HTML ones
const XTABS = [['airport', 'Protein'], ['path', 'Paths'], ['hubs', 'Hubs'], ['communities', 'Modules'], ['closures', 'Knockouts']];
function drawExplorePane(ctx, P, x, y, W) {
  const tw = W / XTABS.length;
  XTABS.forEach(([k, n], j) => {
    const on = X.tab === k, tx = x + j * tw, hov = P.hover === 'tab:' + k;
    if (hov && !on) { rr(ctx, tx + 4, y, tw - 8, 62, 8); ctx.fillStyle = VC.chip; ctx.fill(); }
    ctx.font = vfont(24, on ? 700 : 400); ctx.fillStyle = on ? VC.ink : VC.muted;
    ctx.textAlign = 'center'; ctx.fillText(n, tx + tw / 2, y + 18); ctx.textAlign = 'left';
    if (on) { ctx.fillStyle = VC.cyan; ctx.fillRect(tx + 12, y + 58, tw - 24, 4); }
    P.regions.push({ id: 'tab:' + k, x: tx, y, w: tw, h: 64, fn: () => { XR.kbd.open = false; showTab(k); } });
  });
  ctx.fillStyle = VC.line; ctx.fillRect(x, y + 62, W, 2);
  y += 92;
  const bottom = P.h - 34;
  if (XR.kbd.open && (X.tab === 'airport' || X.tab === 'path')) return drawKeyboard(ctx, P, x, y, W);
  if (X.tab === 'airport') drawAirportPane(ctx, P, x, y, W, bottom);
  else if (X.tab === 'path') drawPathPane(ctx, P, x, y, W, bottom);
  else if (X.tab === 'hubs') drawHubsPane(ctx, P, x, y, W);
  else if (X.tab === 'communities') drawCommPane(ctx, P, x, y, W);
  else if (X.tab === 'closures') drawClosePane(ctx, P, x, y, W, bottom);
}
function searchField(ctx, P, x, y, W, text) {
  vButton(ctx, P, 'search', x, y, W, 66, '', () => { XR.kbd.open = true; XR.kbd.q = ''; }, { r: 10 });
  ctx.strokeStyle = VC.muted; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.arc(x + 32, y + 30, 11, 0, 7); ctx.moveTo(x + 40, y + 38); ctx.lineTo(x + 49, y + 47); ctx.stroke();
  ctx.font = vfont(25); ctx.fillStyle = VC.faint; ctx.fillText(text, x + 66, y + 20);
}
function chipFlow(ctx, P, items, x, y, W, maxY, label, fn, idp) {
  let cx = x, cy = y, shown = 0;
  ctx.font = vfont(23);
  for (const it of items) {
    const t = label(it), w = ctx.measureText(t).width + 26;
    if (cx + w > x + W) { cx = x; cy += 50; }
    if (cy + 42 > maxY) break;
    vButton(ctx, P, idp + it, cx, cy, w, 42, t, () => fn(it), { px: 23, r: 6 });
    cx += w + 8; shown++;
  }
  return { h: cy - y + 42, shown };
}
function drawAirportPane(ctx, P, x, y, W, bottom) {
  searchField(ctx, P, x, y, W, 'Search a protein');
  y += 92;
  const i = X.sel, { code, name, city, country, deg, btw, comm } = NET;
  if (i < 0) {
    y += textBlock(ctx, 'Point at any protein in the cell and pull the trigger (or pinch) to see its partners, rank and reach. Drag the cell to turn it, push the thumbstick to spin and zoom, hold the grip to move it.', x, y, W, 28, 41, VC.muted) + 22;
    chipFlow(ctx, P, ['TP53', 'BRCA1', 'EGFR', 'CTNNB1', 'APP', 'PSMA3'], x, y, W, bottom, c => `${c} ${NET.city[A(c)]}`, c => selectAirport(A(c)), 'quick:');
    return;
  }
  const info = airportInfo(i), closed = removed[i];
  y += textBlock(ctx, `${code[i]} ${name[i]}`, x, y, W, 38, 46, VC.ink, 700, 2) + 4;
  y += textBlock(ctx, `${city[i]}, ${country[i]}`, x, y, W, 25, 34, VC.muted, 400, 1) + 18;
  const row = (label, value, small, sw) => {
    ctx.font = vfont(23); ctx.fillStyle = VC.muted; ctx.fillText(label, x, y + 3);
    let vx = x + 190;
    if (sw) { swatch(ctx, vx, y + 5, 22, sw); vx += 34; }
    const hv = textBlock(ctx, value, vx, y, W - (vx - x), 27, 36, VC.ink, 400, 2);
    const hs = small ? textBlock(ctx, small, x + 190, y + hv, W - 190, 21, 29, VC.muted, 400, 2) : 0;
    y += hv + hs + 14;
  };
  row('Partners', `${deg[i]}`, `degree, rank ${fmt(NET.degRank[i])} of ${fmt(NET.N)}`);
  row('Betweenness', `${(btw[i] * 100).toFixed(2)}%`, `of shortest paths between other proteins pass through, rank ${fmt(NET.btwRank[i])}`);
  row('Module', COMM_NAMES[comm[i]], '', commColor(comm[i]));
  if (closed) row('Reach', 'Knocked out', '');
  else if (info.n > 1) row('Reach', `${(info.sum / (info.n - 1)).toFixed(2)} steps on average to ${fmt(info.n - 1)} proteins`, `farthest: ${info.farD} steps, to ${code[info.far]}`);
  else row('Reach', 'No connections', '');
  y += 4;
  vButton(ctx, P, 'apath', x, y, 330, 60, 'Find a path from here', () => {
    xrClearPath();
    XR.pf = i; XR.pt = -1; XR.pick = 'to';
    $('#pf').value = code[i]; $('#pt').value = '';
    showTab('path');
  });
  vButton(ctx, P, 'aclose', x + 342, y, 330, 60, closed && X.manual.has(i) ? 'Restore this protein' : 'Knock out this protein', () => {
    if (X.manual.has(i)) X.manual.delete(i); else X.manual.add(i);
    updateClosures(); renderAirport(i);
  });
  y += 84;
  ctx.font = vfont(22); ctx.fillStyle = VC.muted;
  ctx.fillText(`Binds ${deg[i]} proteins, biggest hubs first`, x, y);
  y += 38;
  const r = chipFlow(ctx, P, info.nb, x, y, W, bottom - 34, j => code[j], j => selectAirport(j), 'nb:');
  if (r.shown < info.nb.length) { ctx.font = vfont(21); ctx.fillStyle = VC.muted; ctx.fillText(`and ${info.nb.length - r.shown} more`, x, y + r.h + 8); }
}
function drawPathPane(ctx, P, x, y, W, bottom) {
  const { code, city } = NET;
  y += textBlock(ctx, 'Shortest paths', x, y, W, 38, 46, VC.ink, 700) + 6;
  y += textBlock(ctx, 'Fewest interaction steps between two proteins. Knocked-out proteins are avoided.', x, y, W, 24, 34, VC.muted) + 18;
  const bw = (W - 16) / 2;
  [['from', 'From', XR.pf], ['to', 'To', XR.pt]].forEach(([k, lab, i], j) => {
    const bx = x + j * (bw + 16), on = XR.pick === k;
    vButton(ctx, P, 'end:' + k, bx, y, bw, 98, '', () => { XR.pick = k; }, { on });
    ctx.font = vfont(21); ctx.fillStyle = on ? VC.cyan : VC.muted; ctx.fillText(on ? lab + ' (pick in the cell)' : lab, bx + 16, y + 14);
    ctx.font = vfont(28, 700); ctx.fillStyle = i >= 0 ? VC.ink : VC.faint;
    ctx.fillText(fitText(ctx, i >= 0 ? `${code[i]}  ${city[i]}` : '—', bw - 32), bx + 16, y + 50);
  });
  y += 116;
  const btns = [['psearch', 'Search', () => { XR.kbd.open = true; XR.kbd.q = ''; }, 130],
    ['pre1', 'BACE1 to BRCA1', () => xrPathPreset(A('BACE1'), A('BRCA1')), 236],
    ['pre2', 'Most remote pair', () => xrPathPreset(A('ORC6'), A('TNF')), 250],
    ['prand', 'Random pair', () => xrPathPreset(Math.floor(Math.random() * NET.N), Math.floor(Math.random() * NET.N)), 196]];
  let bx = x;
  for (const [id, lab, fn, w] of btns) { vButton(ctx, P, id, bx, y, w, 58, lab, fn, { px: 23 }); bx += w + 10; }
  y += 84;
  if (X.pathErr) { textBlock(ctx, X.pathErr, x, y, W, 26, 38, VC.muted); return; }
  if (!X.path) { textBlock(ctx, 'Point at two proteins in the cell, or try one of the examples.', x, y, W, 26, 38, VC.muted); return; }
  const p = X.path, L = p.length - 1;
  ctx.font = vfont(64, 700); ctx.fillStyle = VC.magenta;
  ctx.fillText(`${L} ${L === 1 ? 'step' : 'steps'}`, x, y);
  y += 82;
  y += textBlock(ctx, `From ${code[p[0]]} to ${code[p[L]]} through ${L - 1} ${L === 2 ? 'protein' : 'proteins'} in between. ${X.count > 1 ? `It is one of ${fmt(X.count)} equally short paths.` : 'It is the only path this short.'}`, x, y, W, 23, 33, VC.muted) + 14;
  for (let k = 0; k < L; k++) {
    if (y + 50 > bottom - (k < L - 1 ? 40 : 0)) {
      ctx.font = vfont(21); ctx.fillStyle = VC.muted;
      ctx.fillText(`and ${L - k} more ${L - k === 1 ? 'step' : 'steps'}`, x + 44, y + 10);
      break;
    }
    ctx.fillStyle = VC.line; ctx.fillRect(x, y, W, 2);
    ctx.font = vfont(24, 700); ctx.fillStyle = VC.magenta; ctx.fillText(String(k + 1), x, y + 12);
    ctx.fillStyle = VC.ink; ctx.fillText(`${code[p[k]]} binds ${code[p[k + 1]]}`, x + 44, y + 12);
    ctx.font = vfont(21); ctx.fillStyle = VC.muted;
    ctx.fillText(fitText(ctx, `${city[p[k]]} · ${city[p[k + 1]]}`, W - 400), x + 360, y + 15);
    y += 52;
  }
}
function drawHubsPane(ctx, P, x, y, W) {
  const by = X.hubsBy, ord = by === 'deg' ? NET.degOrd : NET.btwOrd, { code, city, deg, btw } = NET;
  const top = NET.degOrd.slice(0, 10).reduce((s, i) => s + deg[i], 0) / (2 * NET.E);
  y += textBlock(ctx, 'Hubs', x, y, W, 38, 46, VC.ink, 700) + 6;
  y += textBlock(ctx, `The 10 biggest hubs (4% of these proteins) hold ${Math.round(top * 100)}% of all interaction ends.`, x, y, W, 24, 34, VC.muted) + 16;
  const setBy = b => { X.hubsBy = b; setView('pillars', b); setView('color', b); renderHubs(); };
  vButton(ctx, P, 'by:deg', x, y, 220, 56, 'Most partners', () => setBy('deg'), { on: by === 'deg', px: 23 });
  vButton(ctx, P, 'by:btw', x + 230, y, 290, 56, 'Highest betweenness', () => setBy('btw'), { on: by === 'btw', px: 23 });
  y += 74;
  ord.slice(0, 12).forEach((i, k) => {
    const id = 'hub:' + i, hov = P.hover === id || X.sel === i;
    if (hov) { rr(ctx, x - 8, y, W + 16, 52, 8); ctx.fillStyle = X.sel === i ? VC.on : VC.chip; ctx.fill(); }
    ctx.font = vfont(21); ctx.fillStyle = VC.faint; ctx.textAlign = 'right'; ctx.fillText(String(k + 1), x + 34, y + 15); ctx.textAlign = 'left';
    ctx.font = vfont(25, 700); ctx.fillStyle = VC.ink; ctx.fillText(code[i], x + 54, y + 13);
    ctx.font = vfont(24); ctx.fillStyle = VC.muted; ctx.fillText(fitText(ctx, city[i], W - 330), x + 150, y + 14);
    ctx.fillStyle = VC.ink; ctx.textAlign = 'right';
    ctx.fillText(by === 'deg' ? String(deg[i]) : (btw[i] * 100).toFixed(2) + '%', x + W, y + 14); ctx.textAlign = 'left';
    P.regions.push({ id, x, y, w: W, h: 52, fn: () => { selectAirport(i); showTab('hubs'); } });
    y += 56;
  });
}
function drawCommPane(ctx, P, x, y, W) {
  if (!X.commStats) renderCommunities();
  const s = X.commStats;
  y += textBlock(ctx, 'Modules', x, y, W, 38, 46, VC.ink, 700) + 6;
  y += textBlock(ctx, `Louvain found ${STATS.nComm} modules (modularity ${STATS.q.toFixed(2)}). Select one to isolate it in the cell.`, x, y, W, 24, 34, VC.muted) + 14;
  COMM_NAMES.forEach((n, k) => {
    const id = 'comm:' + k, on = X.iso === k, hov = P.hover === id;
    if (on || hov) { rr(ctx, x - 8, y, W + 16, 72, 8); ctx.fillStyle = on ? VC.on : VC.chip; ctx.fill(); }
    swatch(ctx, x + 2, y + 13, 22, commColor(k));
    ctx.font = vfont(25); ctx.fillStyle = VC.ink;
    ctx.fillText(n, x + 38, y + 9);
    ctx.font = vfont(21); ctx.fillStyle = VC.muted; ctx.textAlign = 'right';
    ctx.fillText(`${fmt(s[k].n)} proteins`, x + W, y + 12); ctx.textAlign = 'left';
    ctx.fillStyle = VC.faint;
    ctx.fillText(`Hubs ${s[k].hubs.join(', ')}. ${Math.round(100 * s[k].inside / s[k].touch)}% of its interactions stay inside.`, x + 38, y + 41);
    P.regions.push({ id, x, y, w: W, h: 72, fn: () => { X.iso = X.iso === k ? -1 : k; setView('color', 'comm'); renderCommunities(); } });
    y += 76;
  });
}
function drawClosePane(ctx, P, x, y, W, bottom) {
  y += textBlock(ctx, 'Knockouts', x, y, W, 38, 46, VC.ink, 700) + 6;
  y += textBlock(ctx, 'Knock out proteins and see how much of the network still hangs together.', x, y, W, 24, 34, VC.muted) + 16;
  const modes = [['btw', 'Most central first', 270], ['deg', 'Most partners first', 270], ['rnd', 'Random', 150]];
  let bx = x;
  for (const [m, lab, w] of modes) {
    vButton(ctx, P, 'cm:' + m, bx, y, w, 56, lab, () => {
      X.closeMode = m;
      document.querySelectorAll('#pane-closures [data-m]').forEach(b => b.setAttribute('aria-pressed', b.dataset.m === m));
      updateClosures();
    }, { on: X.closeMode === m, px: 23 });
    bx += w + 10;
  }
  y += 76;
  ctx.font = vfont(24); ctx.fillStyle = VC.muted;
  ctx.fillText(`Proteins knocked out: ${X.closeK}${X.manual.size ? ` plus ${X.manual.size} by hand` : ''}`, x, y);
  y += 40;
  // slider: drag along the track, or step with the buttons
  const sw = W - 2 * 92 - 2 * 76 - 40, sx = x + 92 + 76 + 20, frac = Math.min(60, X.closeK) / 60;
  vButton(ctx, P, 'k-10', x, y, 84, 56, '−10', () => xrSetK(X.closeK - 10), { px: 22 });
  vButton(ctx, P, 'k-1', x + 92, y, 68, 56, '−1', () => xrSetK(X.closeK - 1), { px: 22 });
  vButton(ctx, P, 'k+1', sx + sw + 20, y, 68, 56, '+1', () => xrSetK(X.closeK + 1), { px: 22 });
  vButton(ctx, P, 'k+10', sx + sw + 96, y, 84, 56, '+10', () => xrSetK(X.closeK + 10), { px: 22 });
  rr(ctx, sx, y + 25, sw, 6, 3); ctx.fillStyle = 'rgba(160,178,202,0.3)'; ctx.fill();
  rr(ctx, sx, y + 25, sw * frac, 6, 3); ctx.fillStyle = VC.red; ctx.fill();
  ctx.beginPath(); ctx.arc(sx + sw * frac, y + 28, P.hover === 'kslider' ? 17 : 14, 0, 7); ctx.fillStyle = VC.red; ctx.fill();
  P.regions.push({ id: 'kslider', x: sx - 16, y, w: sw + 32, h: 56, drag: px => xrSetK((px - sx) / sw * 60) });
  y += 78;
  const r = closureInfo();
  ctx.font = vfont(68, 700); ctx.fillStyle = r.pairs > 0.9 ? VC.green : r.pairs > 0.7 ? VC.amber : VC.red;
  ctx.fillText((r.pairs * 100).toFixed(1) + '%', x, y);
  y += 78;
  ctx.font = vfont(23); ctx.fillStyle = VC.muted; ctx.fillText('of protein pairs can still reach each other', x, y);
  y += 44;
  ctx.fillText('Largest group', x, y); ctx.fillText('Interactions lost', x + W / 2, y);
  ctx.font = vfont(27); ctx.fillStyle = VC.ink;
  ctx.fillText(`${(r.lcc * 100).toFixed(1)}% of proteins`, x, y + 32); ctx.fillText(`${fmt(r.lost)} of ${fmt(NET.E)}`, x + W / 2, y + 32);
  y += 84;
  if (X.curve) {
    const cd = X.curve, ch = 150, X0 = x, sy = v => y + ch - v * 140, sxk = k => X0 + k / 60 * W;
    ctx.strokeStyle = VC.line; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(X0, sy(0.5)); ctx.lineTo(X0 + W, sy(0.5)); ctx.stroke();
    for (const [arr, col] of [[cd.rnd, VC.green], [cd.deg, VC.amber], [cd.tgt, VC.red]]) {
      ctx.strokeStyle = col; ctx.lineWidth = 3; ctx.beginPath();
      cd.ks.forEach((k, j) => (j ? ctx.lineTo(sxk(k), sy(arr[j])) : ctx.moveTo(sxk(k), sy(arr[j]))));
      ctx.stroke();
    }
    ctx.setLineDash([6, 6]); ctx.strokeStyle = VC.ink; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(sxk(Math.min(60, X.closeK)), y); ctx.lineTo(sxk(Math.min(60, X.closeK)), y + ch); ctx.stroke();
    ctx.setLineDash([]);
    y += ch + 10;
    ctx.font = vfont(20);
    let lx = x;
    for (const [lab, col] of [['Most central first', VC.red], ['most partners first', VC.amber], ['random', VC.green]]) {
      ctx.fillStyle = col; ctx.fillText(lab, lx, y); lx += ctx.measureText(lab).width + 22;
    }
    y += 40;
  }
  vButton(ctx, P, 'reopen', x, y, 300, 56, 'Restore all proteins', () => { X.closeK = 0; X.manual.clear(); $('#kslider').value = 0; updateClosures(); }, { px: 23 });
  if (X.manual.size) chipFlow(ctx, P, [...X.manual], x + 316, y + 6, W - 316, bottom, j => NET.code[j] + ' ✕', j => { X.manual.delete(j); updateClosures(); }, 'man:');
}
// on-panel keyboard for searching airports
const KROWS = ['QWERTYUIOP', 'ASDFGHJKL', 'ZXCVBNM'];
function drawKeyboard(ctx, P, x, y, W) {
  const kb = XR.kbd, forPath = X.tab === 'path';
  ctx.font = vfont(22); ctx.fillStyle = VC.muted;
  ctx.fillText(forPath ? `Search the ${XR.pick === 'from' ? 'From' : 'To'} protein` : 'Search a protein by gene symbol or name', x, y);
  y += 36;
  rr(ctx, x, y, W, 70, 10); ctx.fillStyle = 'rgba(149,166,189,0.10)'; ctx.fill();
  ctx.lineWidth = 2; ctx.strokeStyle = VC.cyan; ctx.stroke();
  ctx.font = vfont(32); ctx.fillStyle = kb.q ? VC.ink : VC.faint;
  const shown = kb.q || 'Type with the keys below';
  ctx.fillText(shown, x + 20, y + 18);
  if (kb.q) { const w = ctx.measureText(kb.q).width; ctx.fillStyle = VC.cyan; ctx.fillRect(x + 24 + w, y + 16, 3, 38); }
  y += 88;
  const route = /\s(to|-|>)\s/i.test(kb.q.trim()), sug = route ? [] : matches(kb.q, 5);
  if (route) textBlock(ctx, 'Press Find path for the shortest path between these two proteins.', x, y, W, 25, 36, VC.muted);
  else if (kb.q && !sug.length) textBlock(ctx, `No protein matches “${kb.q}”.`, x, y, W, 25, 36, VC.muted);
  else if (!kb.q) textBlock(ctx, 'Tip: type two symbols with TO between them, like TP53 TO BRCA1, to find a path.', x, y, W, 24, 34, VC.faint);
  sug.forEach((i, k) => {
    const id = 'sug:' + i, yy = y + k * 60;
    vButton(ctx, P, id, x, yy, W, 54, '', () => xrPickSuggestion(i), { r: 8 });
    ctx.font = vfont(25, 700); ctx.fillStyle = VC.ink; ctx.fillText(NET.code[i], x + 16, yy + 14);
    ctx.font = vfont(23); ctx.fillStyle = VC.muted; ctx.fillText(fitText(ctx, `${NET.city[i]}, ${NET.country[i]}`, W - 300), x + 106, yy + 15);
    ctx.fillStyle = VC.faint; ctx.textAlign = 'right'; ctx.fillText(`${NET.deg[i]} partners`, x + W - 16, yy + 15); ctx.textAlign = 'left';
  });
  const kw = 84, kh = 70, g = 9, ky0 = P.h - 34 - 4 * kh - 3 * g;
  KROWS.forEach((row, r) => {
    const rw = row.length * kw + (row.length - 1) * g, rx = x + (W - rw) / 2 - (r === 2 ? 50 : 0);
    [...row].forEach((ch, k) => vButton(ctx, P, 'key:' + ch, rx + k * (kw + g), ky0 + r * (kh + g), kw, kh, ch,
      () => { kb.q = (kb.q + ch).slice(0, 24); }, { px: 28 }));
    if (r === 2) vButton(ctx, P, 'key:back', rx + rw + g, ky0 + r * (kh + g), 2 * kw, kh, '⌫ Delete', () => { kb.q = kb.q.slice(0, -1); }, { px: 24 });
  });
  const by = ky0 + 3 * (kh + g);
  vButton(ctx, P, 'key:space', x + 40, by, 380, kh, 'Space', () => { if (kb.q && !kb.q.endsWith(' ')) kb.q += ' '; }, { px: 24 });
  vButton(ctx, P, 'key:clear', x + 432, by, 170, kh, 'Clear', () => { kb.q = ''; }, { px: 24 });
  vButton(ctx, P, 'key:done', x + 614, by, 290, kh, route ? 'Find path' : sug.length ? 'Choose ' + NET.code[sug[0]] : 'Close', () => {
    if (route) {
      kb.open = false; runQuery(kb.q.trim()); kb.q = '';
      if (X.pathEnds) { XR.pf = X.pathEnds[0]; XR.pt = X.pathEnds[1]; XR.pick = 'to'; }
    } else if (sug.length) xrPickSuggestion(sug[0]); else kb.open = false;
  }, { px: 24, primary: route || !!sug.length });
}

// ----------------------------------------------------------- footer panel --
function sigFoot() {
  return APP.mode === 'story' ? 's' + Math.round(APP.t * 4) + APP.playing + (curCh ? curCh.key : '')
    : 'x' + X.color + X.pillars + X.routes.toFixed(2);
}
function drawFoot(ctx, P) {
  if (APP.mode === 'story') {
    const playing = APP.playing, bx = 28, by = 40;
    vButton(ctx, P, 'play', bx, by, 96, 96, '', () => APP.togglePlay(), { r: 48 });
    ctx.fillStyle = VC.ink;
    if (playing) { ctx.fillRect(bx + 34, by + 30, 10, 36); ctx.fillRect(bx + 52, by + 30, 10, 36); }
    else { ctx.beginPath(); ctx.moveTo(bx + 38, by + 26); ctx.lineTo(bx + 38, by + 70); ctx.lineTo(bx + 72, by + 48); ctx.closePath(); ctx.fill(); }
    const t = APP.t, ci = Math.max(0, CH.findIndex(c => t >= c.na && t < c.nb));
    const tri = (cx, cy, dir) => { ctx.beginPath(); ctx.moveTo(cx - 9 * dir, cy - 13); ctx.lineTo(cx - 9 * dir, cy + 13); ctx.lineTo(cx + 9 * dir, cy); ctx.closePath(); ctx.fill(); };
    vButton(ctx, P, 'prev', 140, 52, 78, 72, '', () => APP.seek(t > CH[ci].na + 2 || ci === 0 ? CH[ci].na : CH[ci - 1].na));
    ctx.fillStyle = VC.ink; tri(171, 88, -1); ctx.fillRect(184, 75, 5, 26);
    vButton(ctx, P, 'next', 228, 52, 78, 72, '', () => APP.seek(ci < CH.length - 1 ? CH[ci + 1].na : T_END - 0.01));
    ctx.fillStyle = VC.ink; tri(262, 88, 1); ctx.fillRect(271, 75, 5, 26);
    const x0 = 344, x1 = P.w - 40, ty = 100;
    const m = s => Math.floor(s / 60) + ':' + String(Math.floor(s % 60)).padStart(2, '0');
    ctx.font = vfont(27, 700); ctx.fillStyle = VC.ink; ctx.fillText(CH[ci].name, x0, 40);
    ctx.font = vfont(22); ctx.fillStyle = VC.muted; ctx.textAlign = 'right'; ctx.fillText(m(t) + ' / ' + m(T_END), x1, 44); ctx.textAlign = 'left';
    rr(ctx, x0, ty, x1 - x0, 6, 3); ctx.fillStyle = 'rgba(160,178,202,0.28)'; ctx.fill();
    rr(ctx, x0, ty, (x1 - x0) * t / T_END, 6, 3); ctx.fillStyle = VC.cyan; ctx.fill();
    ctx.fillStyle = 'rgba(160,178,202,0.6)';
    for (const c of CH.slice(1)) ctx.fillRect(x0 + (x1 - x0) * c.na / T_END - 1, ty - 8, 2, 22);
    ctx.beginPath(); ctx.arc(x0 + (x1 - x0) * t / T_END, ty + 3, P.hover === 'track' ? 16 : 13, 0, 7); ctx.fillStyle = VC.cyan; ctx.fill();
    P.regions.push({ id: 'track', x: x0 - 10, y: 66, w: x1 - x0 + 20, h: 80, drag: px => APP.seek(clamp((px - x0) / (x1 - x0), 0, 1) * T_END) });
    return;
  }
  const seg = (y, label, name, opts) => {
    ctx.font = vfont(22); ctx.fillStyle = VC.muted; ctx.fillText(label, 28, y + 18);
    let x = 122;
    for (const [v, n, w] of opts) { vButton(ctx, P, name + ':' + v, x, y, w, 56, n, () => setView(name, v), { on: X[name] === v, px: 22 }); x += w + 8; }
    return x;
  };
  seg(22, 'Color', 'color', [['plain', 'Plain', 104], ['deg', 'Partners', 120], ['btw', 'Betweenness', 176], ['comm', 'Module', 130]]);
  let x = seg(96, 'Pillars', 'pillars', [['off', 'Off', 80], ['deg', 'Partners', 120], ['btw', 'Betweenness', 176]]) + 22;
  ctx.font = vfont(22); ctx.fillStyle = VC.muted; ctx.fillText('Lines', x, 114); x += 64;
  const setRoutes = v => { X.routes = clamp(Math.round(v * 20) / 20, 0, 1.6); $('#rta').value = X.routes; };
  vButton(ctx, P, 'rt-', x, 96, 56, 56, '−', () => setRoutes(X.routes - 0.15), { px: 28 });
  vButton(ctx, P, 'rt+', x + 62, 96, 56, 56, '+', () => setRoutes(X.routes + 0.15), { px: 28 }); x += 140;
  ctx.font = vfont(22); ctx.fillStyle = VC.muted; ctx.fillText('Zoom', x, 114); x += 66;
  vButton(ctx, P, 'z-', x, 96, 56, 56, '−', () => xrZoom(1.3), { px: 28 });
  vButton(ctx, P, 'z+', x + 62, 96, 56, 56, '+', () => xrZoom(1 / 1.3), { px: 28 });
}


// ------------------------------------------------------------- narration --
// Optional voice-over: put an MP3 at audio/narration-proteins.mp3.
// Second 0 of the recording plays at second 0 of the story; the story clock
// follows the audio, so seeking, pausing and chapter jumps stay in sync.
// Without the file the story runs silently. The sound engine is the shell's
// (HOST.audio): one engine for the whole app, unlocked by the first tap or click
// and kept running across stories and headset sessions.
let AUD = null;
function audioInit() {
  AUD = HOST.audio.narration('audio/narration-proteins.mp3', {
    // a recording longer than the story stretches the timeline
    ready(d) {
      if (d + 1 <= T_END) return;
      T_END = d + 1;
      document.querySelectorAll('#track .tick, #track .name').forEach(el => {
        const c = C[el.dataset.k]; if (c) el.style.left = (100 * c.na / T_END).toFixed(2) + '%';
      });
      $('#track').setAttribute('aria-valuemax', Math.round(T_END)); lastTick = -1;
    },
    error() { xrMsg('The narration file could not be played. Export it as a standard MP3 and upload it again.'); },
  });
  // react at once to play/pause, seeks, chapter jumps and mode changes
  for (const name of ['seek', 'togglePlay', 'enterExplore', 'enterStory']) {
    const f = APP[name];
    APP[name] = function (...args) { const r = f.apply(APP, args); AUD.seeked(); audioSync(); return r; };
  }
}
// the narration plays while the story plays
function audioSync() { if (AUD) AUD.sync(APP.mode === 'story' && APP.playing, APP.t); }
// while it plays, the narration is the clock: the story follows it
function audioFollow() { if (AUD) APP.t = AUD.follow(APP.t); }
function audioLabel() { return AUD ? AUD.label() : ''; }
function audioToggle() { HOST.audio.toggle(); }

// ================================================================== APP ==
const APP = {
  mode: 'story', t: 0, playing: true,
  seek(t) { this.t = clamp(t, 0, T_END - 0.01); if (this.mode !== 'story') this.enterStory(this.t); },
  togglePlay() { if (this.mode !== 'story') return; if (this.t >= T_END - 0.05) this.t = 0; this.playing = !this.playing; },
  enterExplore() {
    if (this.mode === 'explore') return;
    this.mode = 'explore';
    document.body.classList.add('exploring');
    $('#btnMode').textContent = 'Replay story';
    orbit.cur = storyCam(storyT(this.t)).slice(); orbit.to = null;
    const S = storyState(storyT(this.t));
    for (const n in DEF) XS[n] = S[n];
    Object.assign(XS, { node_reveal: 1, route_reveal: 1, xrm: 1, path_focus: 0, path_prog: 0, sel_prog: 0 });
    ST.labels.forEach(L => { L.el.style.opacity = 0; L.o = 0; });
    setPathAttribute(X.path);
    setClosedAttributes(removed);
    updateExtraLabels();
    $('#panel').scrollTop = 0;
  },
  enterStory(t) {
    this.mode = 'story';
    document.body.classList.remove('exploring');
    $('#btnMode').textContent = 'Explore now';
    setClosedAttributes(new Uint8Array(NET.N));
    setPathAttribute(null);
    LBL.extra.forEach(L => { L.el.remove(); dropSprite(L); }); LBL.extra = [];
    $('#tip').style.opacity = 0;
    this.t = t || 0; this.playing = true; curCh = null;
  },
};

let lastNow = 0;
function frame(now, xrFrame) {
  const dt = lastNow ? Math.min(0.1, Math.max(0, (now - lastNow) / 1000)) : 0;
  lastNow = now;
  const xr = XR.on && GL.renderer.xr.isPresenting;
  if (xr) xrBegin(xrFrame, dt);
  let S;
  if (APP.mode === 'story' && APP.playing) {
    APP.t += dt;
    audioFollow();
    // the end: Repeat (shell) starts this story or the next one again, else explore mode opens
    if (APP.t >= T_END) { APP.t = T_END; if (HOST.ended()) APP.playing = false; else APP.enterExplore(); }
  }
  audioSync();
  const ts = storyT(APP.t); // original story time for this point in the narration
  if (APP.mode === 'story') {
    S = storyState(ts);
    if (xr) xrPlaceGlobe(storyCam(ts)); else applyCamera(storyCam(ts));
    updateStoryDOM(ts);
    updateTimeline(APP.t, APP.playing);
  } else {
    S = exploreStep(dt);
    orbitStep(xr ? performance.now() : now);
    if (xr) xrPlaceGlobe(orbit.cur); else applyCamera(orbit.cur);
  }
  applyUniforms(S, APP.mode === 'explore');
  GL.camera.updateMatrixWorld();
  updateLight(xr);
  if (xr) xrUpdate(S);
  GL.renderer.render(GL.scene, GL.camera);
  if (!xr) {
    if (APP.mode === 'story') ST.labels.forEach(L => placeLabel(L, fadeVal(ts, L.tIn, L.tOut, 0.5), S));
    else LBL.extra.forEach(L => placeLabel(L, 1, S));
  }
  window.__frames = (window.__frames || 0) + 1;
}
function applyTheme() {
  if (!GL.renderer) return;
  if (XR.on && !XR.clear) GL.renderer.setClearColor(0x000000, 0); // passthrough AR shows the room
  else GL.renderer.setClearColor(new THREE.Color(css('--scene') || '#040912'), 1);
}
function init() {
  try {
    buildScene($('#gl'));
  } catch (err) {
    console.error(err);
    $('#nogl').style.display = 'grid';
    $('#loading').classList.add('gone');
    return;
  }
  resize();
  window.addEventListener('resize', resize);
  buildStory(); buildTimeline(); buildExplore(); bindCanvas(); audioInit(); xrSetup();
  setPathAttribute(null);
  applyTheme();
  matchMedia('(prefers-color-scheme: dark)').addEventListener('change', applyTheme);
  (GL.mo = new MutationObserver(applyTheme)).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  $('#btnMode').addEventListener('click', () => (APP.mode === 'story' ? APP.enterExplore() : APP.enterStory(0)));
  document.addEventListener('click', ev => { if (ev.target.id === 'btnGoExplore') APP.enterExplore(); });
  document.addEventListener('keydown', ev => {
    if (ev.target.closest('input, textarea')) return;
    if (ev.key === ' ' && APP.mode === 'story' && !ev.target.closest('button')) { APP.togglePlay(); ev.preventDefault(); }
    if (ev.key === '/' && APP.mode === 'explore') { $('#q').focus(); ev.preventDefault(); }
  });
  APP.playing = !matchMedia('(prefers-reduced-motion: reduce)').matches;
  // the start screen pauses the story; picking this story again starts it from the top
  if (HOST.picking) APP.playing = false;
  window.addEventListener('storypause', () => { APP.playing = false; });
  window.addEventListener('storyrestart', () => { APP.enterStory(0); APP.playing = true; });
  const hp = new URLSearchParams(location.hash.slice(1));
  if (hp.has('t')) { APP.t = clamp(parseFloat(hp.get('t')) || 0, 0, T_END - 0.01); APP.playing = false; }
  if (hp.has('explore')) {
    APP.enterExplore();
    if (hp.get('color')) setView('color', hp.get('color'));
    if (hp.get('pillars')) setView('pillars', hp.get('pillars'));
    if (hp.get('tab')) showTab(hp.get('tab'));
    if (hp.get('k')) { X.closeK = +hp.get('k'); $('#kslider').value = X.closeK; updateClosures(); }
    if (hp.get('iso')) { X.iso = +hp.get('iso'); renderCommunities(); }
    if (hp.get('q')) { $('#q').value = hp.get('q'); runQuery(hp.get('q')); }
    if (hp.get('nofly')) { orbit.cur = orbit.to || orbit.cur; orbit.to = null; }
  }
  GL.renderer.setAnimationLoop(frame); // also drives the headset's frame loop
  if (HOST.session && GL.renderer.xr.isPresenting) xrAdopt();
  setTimeout(() => $('#loading').classList.add('gone'), 120);
}
setTimeout(init, 40);

// what the app shell needs to change story
return {
  inputs: () => XR.ctrls.map(c => c.src),
  xrPose: () => (XR.on ? { rp: GL.rig.position.clone(), rq: GL.rig.quaternion.clone(), off: XR.globeOff.clone(),
    pp: XR.panelGroup.position.clone(), pr: XR.panelGroup.rotation.y } : null),
  // for tests and the browser console: HOST.cur.peek('NET.N')
  peek: src => eval(src),
  dispose() {
    if (GL.mo) GL.mo.disconnect();
    if (XR.session) XR.session.removeEventListener('visibilitychange', xrVisibility);
    if (GL.scene) GL.scene.traverse(o => {
      if (o.geometry) o.geometry.dispose();
      if (o.material) [].concat(o.material).forEach(m => { if (m.map) m.map.dispose(); if (m.uniforms) for (const u of Object.values(m.uniforms)) if (u.value && u.value.isTexture) u.value.dispose(); m.dispose(); });
    });
  },
};
});
