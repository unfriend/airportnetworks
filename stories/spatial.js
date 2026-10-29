// Spatial interactome, where proteins meet in a cell: the cell map story.
// Runs inside index.html, which owns the page, the renderer and the headset session.
HOST.register('spatial', function (HOST) {
'use strict';
// Spatial interactome data: a curated, illustrative set of well-documented human
// proteins, where in the cell they work, and how they bind. Edit the lists below
// to change the cell; positions are worked out when the page loads.

// Compartments: key, name, short name (used in sentences), colour
const PLACES = [
  ['ext', 'Outside the cell', 'outside the cell', [0.86, 0.90, 0.97]],
  ['pm', 'Plasma membrane', 'membrane', [0.30, 0.78, 1.00]],
  ['cyto', 'Cytoplasm', 'cytoplasm', [1.00, 0.82, 0.30]],
  ['cytosk', 'Cytoskeleton', 'cytoskeleton', [0.70, 0.76, 0.86]],
  ['nuc', 'Nucleus', 'nucleus', [0.64, 0.52, 1.00]],
  ['nucl', 'Nucleolus', 'nucleolus', [0.96, 0.62, 1.00]],
  ['ne', 'Nuclear envelope', 'nuclear envelope', [0.44, 0.60, 1.00]],
  ['er', 'Endoplasmic reticulum', 'ER', [0.26, 0.88, 0.56]],
  ['golgi', 'Golgi apparatus', 'Golgi', [1.00, 0.62, 0.22]],
  ['mito', 'Mitochondria', 'mitochondria', [1.00, 0.36, 0.33]],
  ['lyso', 'Lysosomes', 'lysosome', [1.00, 0.36, 0.76]],
  ['endo', 'Endosomes and vesicles', 'vesicles', [0.16, 0.86, 0.80]],
  ['perox', 'Peroxisomes', 'peroxisome', [0.76, 0.93, 0.26]],
];
// Places that touch, so proteins in them can bind across the boundary
// (a receptor and the protein waiting under the membrane, the two faces of a pore ...)
const CONTACTS = 'ext-pm pm-cyto pm-cytosk pm-endo cyto-cytosk cyto-ne cytosk-ne ne-nuc nuc-nucl cyto-er cyto-golgi ' +
  'cyto-mito cyto-lyso cyto-endo cyto-perox cytosk-endo er-mito er-golgi er-ne';

// Proteins: symbol | name | what it does | where it is found (first = its usual place).
// A place can carry a hint: in = inside the organelle, out = outer face, pore = in a nuclear pore,
// mt / actin = on microtubules / on actin filaments.
const PROTEINS = `
EGF|Epidermal growth factor|growth signal|ext
TNF|Tumour necrosis factor|inflammation signal|ext
INS|Insulin|hormone that lowers blood sugar|ext
TF|Transferrin|carries iron|ext endo:in
APOB|Apolipoprotein B|carries LDL cholesterol|ext
PCSK9|PCSK9|sends LDL receptors to be destroyed|ext endo:in
FN1|Fibronectin|matrix the cell grips|ext
EGFR|EGF receptor|growth-factor receptor|pm endo
ERBB2|HER2|growth-factor receptor|pm
INSR|Insulin receptor|senses insulin|pm
TNFRSF1A|TNF receptor 1|senses TNF|pm
CDH1|E-cadherin|glues cells together|pm
CTNNB1|beta-catenin|cell glue and Wnt gene switch|pm cyto nuc
CTNNA1|alpha-catenin|links cell junctions to actin|pm
CTNND1|p120 catenin|keeps E-cadherin at the surface|pm
ITGA5|Integrin alpha-5|fibronectin receptor|pm
ITGB1|Integrin beta-1|grips the matrix|pm
TLN1|Talin|links integrins to actin|pm
VCL|Vinculin|strengthens the grip|pm
PTK2|Focal adhesion kinase|signals from the grip|pm
PXN|Paxillin|focal adhesion scaffold|pm
ATP1A1|Sodium pump alpha|pumps sodium out|pm
ATP1B1|Sodium pump beta|partner of the sodium pump|pm
CFTR|CFTR|chloride channel|pm er
NHERF1|NHERF1|scaffold under the membrane|pm
EZR|Ezrin|links membrane to actin|pm
KRAS|KRAS|growth signal switch|pm
CAV1|Caveolin-1|shapes caveolae|pm
CAVIN1|Cavin-1|coats caveolae|pm
STX4|Syntaxin 4|lets vesicles fuse|pm
SNAP23|SNAP23|vesicle fusion partner|pm
TFRC|Transferrin receptor|brings in iron|pm endo
LDLR|LDL receptor|takes up cholesterol|pm endo
AP2B1|AP-2 beta|links cargo to clathrin|pm
AP2M1|AP-2 mu|picks cargo for clathrin pits|pm
CLTC|Clathrin|coats budding vesicles|pm
DNM2|Dynamin-2|pinches vesicles off|pm
GRB2|GRB2|links receptors to RAS|cyto
SOS1|SOS1|switches RAS on|cyto
RAF1|RAF1|relays RAS signals|cyto
MAP2K1|MEK1|relays to ERK|cyto
MAPK1|ERK2|growth signal kinase|cyto nuc
CBL|CBL|tags receptors for removal|cyto
HSP90AA1|HSP90|chaperone for signalling proteins|cyto
CDC37|CDC37|HSP90 partner for kinases|cyto
STIP1|HOP|links HSP70 and HSP90|cyto
HSPA8|HSC70|everyday protein chaperone|cyto
STUB1|CHIP|tags misfolded proteins|cyto
IRS1|IRS1|relays insulin signals|cyto
PIK3R1|PI3K p85|docks PI3K on receptors|cyto
PIK3CA|PI3K p110|makes the PIP3 signal|cyto
PDPK1|PDK1|switches AKT on|cyto
AKT1|AKT1|growth and survival kinase|cyto
AKT2|AKT2|insulin signal kinase|cyto
TBC1D4|AS160|holds GLUT4 vesicles back|cyto
ASPSCR1|TUG|tethers GLUT4 vesicles|cyto
TSC1|Hamartin|brake on mTOR|cyto
TSC2|Tuberin|brake on mTOR|cyto
TRADD|TRADD|TNF receptor adaptor|cyto
TRAF2|TRAF2|TNF signal adaptor|cyto
RIPK1|RIPK1|TNF signal kinase|cyto
IKBKG|NEMO|IKK regulator|cyto
IKBKB|IKK-beta|frees NF-κB|cyto
CHUK|IKK-alpha|frees NF-κB|cyto
NFKBIA|IκB-alpha|holds NF-κB in the cytoplasm|cyto
RELA|NF-κB p65|inflammation gene switch|cyto nuc
NFKB1|NF-κB p50|inflammation gene switch|cyto nuc
BTRC|beta-TrCP|marks proteins for destruction|cyto
SKP1|SKP1|ubiquitin ligase adaptor|cyto
CUL1|Cullin 1|ubiquitin ligase scaffold|cyto
RBX1|RBX1|ubiquitin ligase core|cyto
KEAP1|KEAP1|oxidant sensor|cyto
CUL3|Cullin 3|ubiquitin ligase scaffold|cyto
NFE2L2|NRF2|antioxidant gene switch|cyto nuc
AXIN1|Axin 1|scaffold that destroys beta-catenin|cyto
APC|APC|destroys beta-catenin|cyto
GSK3B|GSK3-beta|tags beta-catenin|cyto
CSNK1A1|Casein kinase 1|primes beta-catenin|cyto
APAF1|APAF1|builds the apoptosome|cyto
CASP9|Caspase 9|starts cell death|cyto
CASP3|Caspase 3|executes cell death|cyto
XIAP|XIAP|blocks caspases|cyto
BAX|BAX|punches holes in mitochondria|cyto mito
PRKN|Parkin|clears damaged mitochondria|cyto
DNM1L|DRP1|divides mitochondria|cyto
VCP|p97|extracts proteins for destruction|cyto
UFD1|UFD1|p97 partner|cyto
NPLOC4|NPL4|p97 partner|cyto
SRP54|SRP54|steers new proteins to the ER|cyto
PEX5|PEX5|carries cargo into peroxisomes|cyto perox
PEX7|PEX7|peroxisome cargo receptor|cyto
PEX19|PEX19|delivers peroxisome membrane proteins|cyto
SQSTM1|p62|collects proteins for recycling|cyto
UBQLN1|Ubiquilin-1|shuttles proteins to the proteasome|cyto
PSMD4|Proteasome S5a|proteasome ubiquitin receptor|cyto
TIA1|TIA1|forms stress granules|cyto
RAN|Ran|sets the direction of nuclear transport|nuc cyto
KPNB1|Importin beta|carries cargo into the nucleus|cyto ne:pore nuc
KPNA2|Importin alpha|reads nuclear import signals|cyto nuc
TP53|p53|guardian of the genome|nuc mito
MDM2|MDM2|keeps p53 in check|nuc nucl
EP300|p300|switches genes on|nuc
CREBBP|CBP|switches genes on|nuc
ELK1|ELK1|growth gene switch|nuc
SRF|SRF|serum response factor|nuc
FOS|FOS|early growth gene switch|nuc
JUN|JUN|partner of FOS|nuc
TCF7L2|TCF4|Wnt gene switch|nuc
MAFG|MafG|partner of NRF2 on DNA|nuc
SREBF2|SREBP2|cholesterol gene switch|er golgi nuc
TFEB|TFEB|lysosome gene switch|lyso nuc
TARDBP|TDP-43|RNA splicing regulator|nuc cyto
HNRNPA1|hnRNP A1|RNA-binding protein|nuc
HNRNPA2B1|hnRNP A2/B1|RNA-binding protein|nuc
PARP1|PARP1|spots DNA breaks|nuc
XRCC1|XRCC1|DNA repair scaffold|nuc
LIG3|DNA ligase 3|seals DNA|nuc
BRCA1|BRCA1|repairs broken DNA|nuc
BARD1|BARD1|partner of BRCA1|nuc
PALB2|PALB2|links BRCA1 and BRCA2|nuc
BRCA2|BRCA2|loads RAD51 onto DNA|nuc
RAD51|RAD51|repairs DNA by copying|nuc
RCC1|RCC1|loads Ran on chromatin|nuc
XPO1|Exportin 1|carries cargo out of the nucleus|nuc ne:pore
CSE1L|CAS|returns importin alpha|nuc
NPM1|Nucleophosmin|builds ribosomes|nucl
NCL|Nucleolin|organises ribosomal RNA|nucl
FBL|Fibrillarin|modifies ribosomal RNA|nucl
NOP56|NOP56|snoRNA protein|nucl
NOP58|NOP58|snoRNA protein|nucl
CDKN2A|ARF|holds MDM2 in the nucleolus|nucl
NUP62|Nup62|lines the nuclear pore|ne:pore
NUP98|Nup98|lines the nuclear pore|ne:pore
NUP153|Nup153|basket of the nuclear pore|ne:pore-in
NUP214|Nup214|cytoplasmic face of the pore|ne:pore-out
TPR|TPR|filament of the pore basket|ne:pore-in
RANBP2|RanBP2|pore filament facing the cytoplasm|ne:pore-out
RANGAP1|RanGAP1|switches Ran off|ne:pore-out
LMNA|Lamin A|supports the nucleus|ne:in
LMNB1|Lamin B1|supports the nucleus|ne:in
LBR|Lamin B receptor|anchors the lamina|ne
EMD|Emerin|inner nuclear membrane protein|ne
SUN1|SUN1|links nucleus to cytoskeleton|ne
SYNE1|Nesprin-1|links nucleus to actin|ne:out
SEC61A1|Sec61 alpha|channel into the ER|er
SEC61B|Sec61 beta|channel subunit|er
SEC61G|Sec61 gamma|channel subunit|er
SRPRA|SRP receptor alpha|docks SRP at the ER|er
SRPRB|SRP receptor beta|anchors SRP receptor|er
HSPA5|BiP|folds proteins inside the ER|er
CANX|Calnexin|checks protein folding|er
CALR|Calreticulin|checks protein folding|er
PDIA3|ERp57|forms disulfide bonds|er
ERN1|IRE1|senses unfolded proteins|er
EIF2AK3|PERK|senses unfolded proteins|er
ATF6|ATF6|senses unfolded proteins|er
HMGCR|HMG-CoA reductase|makes cholesterol, statin target|er
INSIG1|INSIG1|holds SCAP in the ER|er
SCAP|SCAP|escorts SREBP to the Golgi|er golgi
SYVN1|HRD1|ER quality-control ligase|er
SEL1L|SEL1L|HRD1 partner|er
DERL1|Derlin-1|exit route for misfolded proteins|er
RNF5|RNF5|tags misfolded CFTR|er
SEC23A|Sec23|COPII vesicle coat|er
SEC24A|Sec24|picks COPII cargo|er
SEC13|Sec13|COPII outer coat|er
SEC31A|Sec31|COPII outer coat|er
SAR1A|SAR1|starts COPII budding|er
PREB|SEC12|switches SAR1 on|er
ITPR1|IP3 receptor|releases calcium|er
GOLGA2|GM130|Golgi tether|golgi
GORASP1|GRASP65|stacks Golgi cisternae|golgi
GOLGB1|Giantin|Golgi tether|golgi
USO1|p115|vesicle tether|golgi
RAB1A|RAB1A|ER-to-Golgi traffic switch|golgi
ARF1|ARF1|starts COPI budding|golgi
GBF1|GBF1|switches ARF1 on|golgi
COPA|alpha-COP|COPI coat|golgi
COPB1|beta-COP|COPI coat|golgi
MBTPS1|Site-1 protease|cuts SREBP|golgi
MBTPS2|Site-2 protease|releases active SREBP|golgi
TOMM20|TOM20|import receptor|mito
TOMM22|TOM22|import receptor|mito
TOMM40|TOM40|import channel|mito
TIMM50|TIM50|inner membrane import|mito:in
TIMM23|TIM23|inner membrane channel|mito:in
TIMM17A|TIM17A|channel subunit|mito:in
TIMM44|TIM44|import motor anchor|mito:in
HSPA9|Mortalin|pulls proteins into the matrix|mito:in
HSPD1|HSP60|folds proteins in the matrix|mito:in
HSPE1|HSP10|lid of HSP60|mito:in
TFAM|TFAM|packs mitochondrial DNA|mito:in
POLRMT|Mito RNA polymerase|reads mitochondrial genes|mito:in
TFB2M|TFB2M|starts mitochondrial transcription|mito:in
UQCRC1|UQCRC1|complex III core|mito:in
CYC1|Cytochrome c1|complex III, passes electrons|mito:in
MT-CO1|COX1|complex IV, made in mitochondria|mito:in
MT-CO2|COX2|complex IV, made in mitochondria|mito:in
COX4I1|COX4|complex IV subunit|mito:in
CYCS|Cytochrome c|carries electrons|mito:in cyto
DIABLO|SMAC|releases the caspase brake|mito:in cyto
VDAC1|VDAC1|outer membrane pore|mito
VDAC2|VDAC2|outer membrane pore|mito
HK1|Hexokinase 1|first step of glycolysis|mito
BAK1|BAK|punches holes in mitochondria|mito
BCL2L1|BCL-XL|blocks cell death|mito
BCL2|BCL-2|blocks cell death|mito er
MFN1|Mitofusin 1|fuses mitochondria|mito
MFN2|Mitofusin 2|fuses and tethers mitochondria|mito er
MFF|MFF|recruits DRP1|mito
PINK1|PINK1|flags damaged mitochondria|mito
LAMP2|LAMP2|imports chaperoned proteins|lyso
ATP6V1A|V-ATPase|acidifies the lysosome|lyso
LAMTOR1|LAMTOR1|anchors Ragulator|lyso
LAMTOR2|LAMTOR2|Ragulator subunit|lyso
RRAGA|RagA|senses amino acids|lyso
RRAGC|RagC|senses amino acids|lyso
RPTOR|Raptor|mTORC1 subunit|lyso cyto
MTOR|mTOR|growth controller|lyso cyto
RHEB|RHEB|switches mTOR on|lyso
NPC1|NPC1|exports cholesterol|lyso
NPC2|NPC2|hands cholesterol to NPC1|lyso:in
RAB5A|RAB5A|early endosome switch|endo
EEA1|EEA1|tethers early endosomes|endo
RABEP1|Rabaptin-5|RAB5 partner|endo
RABGEF1|Rabex-5|switches RAB5 on|endo
RAB7A|RAB7A|late endosome switch|endo
RILP|RILP|hooks endosomes to dynein|endo
HGS|HRS|sorts tagged receptors|endo
STAM|STAM|HRS partner|endo
TSG101|TSG101|sorts receptors for destruction|endo
SLC2A4|GLUT4|lets glucose in|endo pm
VAMP2|VAMP2|vesicle fusion protein|endo
LNPEP|IRAP|GLUT4 vesicle protein|endo
RAB10|RAB10|moves GLUT4 vesicles|endo
PEX14|PEX14|docks cargo receptors|perox
PEX13|PEX13|import pore|perox
PEX3|PEX3|receives membrane proteins|perox
CAT|Catalase|breaks down hydrogen peroxide|perox:in
ACOX1|ACOX1|burns long fatty acids|perox:in
TUBA1B|alpha-tubulin|microtubule building block|cytosk:mt
TUBB|beta-tubulin|microtubule building block|cytosk:mt
KIF5B|Kinesin-1|walks cargo outwards|cytosk:mt
KLC1|Kinesin light chain|grips kinesin cargo|cytosk:mt
DYNC1H1|Dynein|walks cargo inwards|cytosk:mt
DCTN1|Dynactin|activates dynein|cytosk:mt
ACTB|Actin|filaments under the membrane|cytosk:actin
PFN1|Profilin|feeds actin growth|cytosk:actin
CFL1|Cofilin|cuts actin filaments|cytosk:actin
`;

// Interactions: two proteins that bind. Where they could meet in more than one
// place, the place is given (SYMBOL@place); a trailing @place applies to both.
const LINKS = `
EGF EGFR@pm
EGFR@pm ERBB2
EGFR@pm GRB2
EGFR@pm CBL
EGFR@pm CAV1
EGFR@endo HGS
CBL GRB2
GRB2 SOS1
GRB2 DNM2
IRS1 GRB2
SOS1 KRAS
KRAS RAF1
RAF1 MAP2K1
CDC37 RAF1
MAP2K1 MAPK1@cyto
MAPK1@nuc ELK1
MAPK1@nuc FOS
ELK1 SRF
FOS JUN
JUN CREBBP
HSP90AA1 ERBB2
HSP90AA1 CDC37
HSP90AA1 STIP1
STIP1 HSPA8
HSPA8 STUB1
HSP90AA1 STUB1
INS INSR
INSR IRS1
IRS1 PIK3R1
PIK3R1 PIK3CA
PDPK1 AKT1
PDPK1 AKT2
AKT2 TBC1D4
TBC1D4 RAB10
TBC1D4 LNPEP
ASPSCR1 SLC2A4@endo
VAMP2 STX4
STX4 SNAP23
AKT1 TSC2
TSC1 TSC2
TSC2 RHEB
TNF TNFRSF1A
TNFRSF1A TRADD
TRADD TRAF2
TRADD RIPK1
RIPK1 IKBKG
IKBKG IKBKB
IKBKG CHUK
IKBKB CHUK
IKBKB NFKBIA
NFKBIA RELA@cyto
NFKBIA NFKB1@cyto
RELA NFKB1 @cyto
RELA NFKB1 @nuc
RELA@nuc EP300
RELA@nuc CREBBP
BTRC NFKBIA
BTRC CTNNB1@cyto
BTRC SKP1
SKP1 CUL1
CUL1 RBX1
CDH1 CTNNB1@pm
CTNNB1@pm CTNNA1
CDH1 CTNND1
CTNNA1 ACTB
CTNNB1@cyto AXIN1
CTNNB1@cyto APC
AXIN1 APC
AXIN1 GSK3B
AXIN1 CSNK1A1
CTNNB1@nuc TCF7L2
CTNNB1@nuc EP300
KEAP1 NFE2L2@cyto
KEAP1 CUL3
CUL3 RBX1
SQSTM1 KEAP1
NFE2L2@nuc MAFG
NFE2L2@nuc CREBBP
TP53 MDM2 @nuc
TP53@nuc EP300
TP53@mito BCL2L1
TP53@mito BAK1
MDM2@nucl CDKN2A
NPM1 CDKN2A
NPM1 NCL
FBL NOP56
NOP56 NOP58
PARP1 XRCC1
XRCC1 LIG3
BRCA1 BARD1
BRCA1 PALB2
PALB2 BRCA2
BRCA2 RAD51
TARDBP@nuc HNRNPA1
TARDBP@nuc HNRNPA2B1
HNRNPA1 HNRNPA2B1
TARDBP@cyto TIA1
TARDBP@cyto SQSTM1
TARDBP@cyto UBQLN1
UBQLN1 PSMD4
KPNA2 KPNB1 @cyto
KPNB1@ne NUP62
KPNB1@ne NUP153
KPNB1@ne NUP98
KPNB1@ne RANBP2
KPNB1 RAN @nuc
RAN@nuc RCC1
RAN XPO1 @nuc
RAN@nuc CSE1L
KPNA2@nuc CSE1L
XPO1@ne NUP214
RAN@cyto RANGAP1
RAN@cyto RANBP2
RANBP2 RANGAP1
NUP62 NUP214
NUP153 TPR
LMNA EMD
LMNB1 LBR
LMNA SUN1
SUN1 SYNE1
SYNE1 ACTB
SRP54 SRPRA
SRPRA SRPRB
SEC61A1 SEC61B
SEC61A1 SEC61G
HSPA5 SEC61A1
HSPA5 ERN1
HSPA5 EIF2AK3
HSPA5 ATF6
CANX PDIA3
CALR PDIA3
HMGCR INSIG1
SCAP@er INSIG1
SCAP SREBF2 @er
SCAP SREBF2 @golgi
SCAP@er SEC24A
SEC23A SEC24A
SEC13 SEC31A
SEC23A SEC31A
SAR1A SEC23A
PREB SAR1A
SYVN1 SEL1L
SYVN1 DERL1
RNF5 DERL1
VCP DERL1
VCP UFD1
UFD1 NPLOC4
CFTR@er CANX
CFTR@er HSPA8
CFTR@er HSP90AA1
CFTR@er STUB1
CFTR@er RNF5
CFTR@pm NHERF1
NHERF1 EZR
EZR ACTB
BCL2@er ITPR1
MFN2@er MFN1
MFN1 MFN2@mito
GOLGA2 GORASP1
GOLGA2 USO1
GOLGB1 USO1
GOLGA2 RAB1A
USO1 RAB1A
ARF1 GBF1
ARF1 COPB1
COPA COPB1
SREBF2@golgi MBTPS1
SREBF2@golgi MBTPS2
SREBF2@nuc CREBBP
TOMM20 TOMM40
TOMM22 TOMM40
TOMM22 TIMM50
TIMM23 TIMM50
TIMM23 TIMM17A
TIMM44 TIMM23
HSPA9 TIMM44
HSPA9 HSPD1
HSPD1 HSPE1
TFAM POLRMT
POLRMT TFB2M
UQCRC1 CYC1
CYCS@mito CYC1
CYCS@mito MT-CO2
MT-CO2 MT-CO1
MT-CO1 COX4I1
VDAC1 HK1
VDAC2 BAK1
BAK1 BCL2L1
BAX BCL2 @mito
BAX@mito BCL2L1
MFF DNM1L
PINK1 PRKN
PRKN MFN2@mito
PRKN VDAC1
CYCS@cyto APAF1
APAF1 CASP9
CASP9 CASP3
XIAP CASP9
XIAP CASP3
DIABLO@cyto XIAP
LAMTOR1 LAMTOR2
LAMTOR1 RRAGA
LAMTOR1 RRAGC
RRAGA RRAGC
RRAGA RPTOR@lyso
RRAGC RPTOR@lyso
RPTOR MTOR @lyso
RPTOR MTOR @cyto
MTOR@lyso RHEB
ATP6V1A LAMTOR1
RRAGC TFEB@lyso
MTOR TFEB @lyso
LAMP2 HSPA8
NPC1 NPC2
RAB5A EEA1
RAB5A RABEP1
RABEP1 RABGEF1
RAB7A RILP
RILP DCTN1
HGS STAM
HGS TSG101
TF TFRC @endo
TF@ext TFRC@pm
AP2M1 TFRC@pm
AP2M1 AP2B1
AP2B1 CLTC
LDLR@pm APOB
LDLR@pm PCSK9@ext
LDLR PCSK9 @endo
PEX5@perox PEX14
PEX14 PEX13
PEX5@perox CAT
PEX5@perox ACOX1
PEX5@cyto PEX7
PEX19 PEX3
TUBA1B TUBB
KIF5B KLC1
KIF5B TUBB
DYNC1H1 DCTN1
DCTN1 TUBB
ACTB PFN1
ACTB CFL1
FN1 ITGA5
ITGA5 ITGB1
ITGB1 TLN1
ITGB1 PTK2
TLN1 VCL
VCL ACTB
PTK2 PXN
PXN VCL
ATP1A1 ATP1B1
CAV1 CAVIN1
`;

// Proteins that share one organelle (one mitochondrion, one vesicle ...) in the model
const TOGETHER = [
  'CYCS@mito BAK1 DIABLO@mito VDAC2',
  'PINK1 VDAC1 MFN2@mito MFN1 MFF',
  'SLC2A4@endo VAMP2 LNPEP RAB10',
  'EGFR@endo HGS RAB5A',
  'PEX3 PEX14',
  'TFRC@endo LDLR@endo',
];

// Moves: proteins change place, and the network rewires. rest = copies present
// in a resting cell only, on = copies present once the move has happened, gone =
// destroyed on the way, travel = who moves where, cue = the signal that starts it.
const MOVES = [
  { key: 'nfkb', name: 'Inflammation', title: 'TNF sends NF-κB into the nucleus',
    rest: 'RELA@cyto NFKB1@cyto NFKBIA', on: 'RELA@nuc NFKB1@nuc', gone: 'NFKBIA',
    travel: 'RELA@cyto>RELA@nuc NFKB1@cyto>NFKB1@nuc', cue: 'TNF TNFRSF1A TRADD RIPK1 IKBKG IKBKB NFKBIA',
    text: 'TNF outside the cell starts a relay to the IKK kinases, which mark IκBα for destruction. Freed, NF-κB moves into the nucleus and switches on inflammation genes.' },
  { key: 'apop', name: 'Cell death', title: 'Mitochondria release death signals',
    rest: 'BAX@cyto CYCS@mito DIABLO@mito', on: 'BAX@mito CYCS@cyto DIABLO@cyto',
    travel: 'BAX@cyto>BAX@mito CYCS@mito>CYCS@cyto DIABLO@mito>DIABLO@cyto', cue: '',
    text: 'BAX moves onto mitochondria and, with BAK, opens holes in their outer membrane. Cytochrome c and SMAC escape: cytochrome c builds the apoptosome with APAF1, SMAC disarms XIAP, and caspases take the cell apart.' },
  { key: 'tfeb', name: 'Starvation', title: 'TFEB leaves the lysosome',
    rest: 'TFEB@lyso MTOR@lyso RPTOR@lyso', on: 'TFEB@nuc MTOR@cyto RPTOR@cyto',
    travel: 'TFEB@lyso>TFEB@nuc MTOR@lyso>MTOR@cyto RPTOR@lyso>RPTOR@cyto', cue: '',
    text: 'With nutrients around, mTORC1 sits on lysosomes and keeps TFEB out of the nucleus. When food runs out, mTORC1 lets go and TFEB moves into the nucleus to switch on genes for new lysosomes and recycling.' },
  { key: 'glut4', name: 'Insulin', title: 'GLUT4 goes to the surface',
    rest: 'SLC2A4@endo', on: 'SLC2A4@pm', travel: 'SLC2A4@endo>SLC2A4@pm', cue: 'INS INSR IRS1 PIK3R1 PIK3CA',
    text: 'Insulin switches on AKT2, which releases the brake AS160. Vesicles carrying the glucose channel GLUT4 fuse with the membrane, and muscle and fat cells take up sugar from the blood.' },
  { key: 'nrf2', name: 'Oxidative stress', title: 'NRF2 escapes KEAP1',
    rest: 'NFE2L2@cyto', on: 'NFE2L2@nuc', travel: 'NFE2L2@cyto>NFE2L2@nuc', cue: '',
    text: 'KEAP1 normally hands NRF2 over for destruction. Oxidants switch KEAP1 off, so NRF2 builds up, moves into the nucleus and with MafG switches on antioxidant genes.' },
  { key: 'als', name: 'ALS', title: 'TDP-43 leaves the nucleus', disease: true,
    rest: 'TARDBP@nuc', on: 'TARDBP@cyto', travel: 'TARDBP@nuc>TARDBP@cyto', cue: '',
    text: 'In nearly all people with ALS, TDP-43 disappears from the nucleus of motor neurons and clumps in the cytoplasm. Its splicing partners lose it, while p62, ubiquilin and stress-granule proteins gain it.' },
  { key: 'cf', name: 'Cystic fibrosis', title: 'CFTR is stuck in the ER', disease: true,
    rest: 'CFTR@pm', on: '', fail: 'CFTR@er>CFTR@pm', cue: '',
    text: 'The most common cystic fibrosis mutation, F508del, makes CFTR fold badly. Quality control in the ER (calnexin, HSC70, CHIP, RNF5) catches it and sends it for destruction, so it never reaches the membrane.' },
];

const D2R = Math.PI / 180;
const $ = s => document.querySelector(s);
const smooth = x => (x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x));
const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);
const fmt = n => Math.round(n).toLocaleString('en-US');
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const css = name => getComputedStyle(document.documentElement).getPropertyValue(name).trim();
function mulberry(seed) {
  return () => {
    seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
// small vector helpers on plain arrays
const v3 = {
  add: (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]],
  sub: (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]],
  mul: (a, s) => [a[0] * s, a[1] * s, a[2] * s],
  dot: (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2],
  len: a => Math.hypot(a[0], a[1], a[2]),
  norm: a => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; },
  cross: (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]],
  lerp: (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t],
};
// any unit vector perpendicular to d
const perp = d => v3.norm(v3.cross(d, Math.abs(d[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0]));

// ------------------------------------------------------------------ network --
// Every protein gets one "copy" per place it is found in. Interactions join copies
// that meet; dotted identity links join the copies of the same protein.
const NET = (() => {
  const PK = PLACES.map(p => p[0]), placeIdx = new Map(PK.map((k, i) => [k, i]));
  const contact = new Set();
  PK.forEach((_, i) => contact.add(i + '-' + i));
  CONTACTS.split(/\s+/).filter(Boolean).forEach(s => {
    const [a, b] = s.split('-').map(k => placeIdx.get(k));
    contact.add(a + '-' + b); contact.add(b + '-' + a);
  });
  const sym = [], name = [], role = [], pPlaces = [], pCopies = [], index = new Map();
  const cProt = [], cPlace = [], cHint = [];
  const copyOf = new Map(); // 'SYM@place' -> copy
  PROTEINS.trim().split('\n').forEach(line => {
    const [s, n, r, pl] = line.split('|');
    if (index.has(s)) console.warn('duplicate protein', s);
    const p = sym.length;
    index.set(s, p); sym.push(s); name.push(n); role.push(r); pPlaces.push([]); pCopies.push([]);
    pl.trim().split(/\s+/).forEach(tok => {
      const [k, h] = tok.split(':'), pi = placeIdx.get(k);
      if (pi === undefined) console.warn('unknown place', s, k);
      const c = cProt.length;
      cProt.push(p); cPlace.push(pi); cHint.push(h || '');
      pPlaces[p].push(pi); pCopies[p].push(c);
      copyOf.set(s + '@' + k, c);
    });
  });
  const P = sym.length, NC = cProt.length;
  // "SYM" or "SYM@place" -> copy (the protein's usual place when not given)
  const resolve = t => {
    if (t.includes('@')) { const c = copyOf.get(t); if (c === undefined) console.warn('no such copy', t); return c; }
    const p = index.get(t);
    if (p === undefined) { console.warn('no such protein', t); return undefined; }
    return pCopies[p][0];
  };
  // interactions
  const eu = [], ev = [], seen = new Set();
  LINKS.trim().split('\n').forEach(line => {
    const tk = line.trim().split(/\s+/);
    let both = null;
    if (tk.length === 3 && tk[2][0] === '@') both = tk[2].slice(1);
    const ends = tk.slice(0, 2).map(t => (both && !t.includes('@') ? t + '@' + both : t));
    const opts = [];
    const cand = ends.map(t => {
      if (t.includes('@')) { const c = copyOf.get(t); if (c === undefined) console.warn('no such copy in', line, t); return [c]; }
      const p = index.get(t);
      if (p === undefined) { console.warn('no such protein in', line, t); return []; }
      return pCopies[p];
    });
    for (const a of cand[0]) for (const b of cand[1]) {
      if (a === undefined || b === undefined) continue;
      const pa = cPlace[a], pb = cPlace[b];
      if (pa === pb) opts.push([0, a, b]); else if (contact.has(pa + '-' + pb)) opts.push([1, a, b]);
    }
    if (!opts.length) { console.warn('these proteins never meet:', line); return; }
    opts.sort((x, y) => x[0] - y[0]);
    if (opts.length > 1 && opts[1][0] === opts[0][0]) console.warn('ambiguous place for', line, opts.map(o => PK[cPlace[o[1]]] + '/' + PK[cPlace[o[2]]]).join(' '));
    const [, a, b] = opts[0], key = Math.min(a, b) + '-' + Math.max(a, b);
    if (seen.has(key)) { console.warn('duplicate interaction', line); return; }
    if (cProt[a] === cProt[b]) { console.warn('self interaction', line); return; }
    seen.add(key); eu.push(a); ev.push(b);
  });
  const E = eu.length;
  // identity links: every extra copy joins the protein's usual copy (or the nearest one in the chain)
  const iu = [], iv = [];
  for (let p = 0; p < P; p++) {
    const cs = pCopies[p];
    for (let k = 1; k < cs.length; k++) { iu.push(cs[k === 1 ? 0 : k - 1]); iv.push(cs[k]); }
  }
  const I = iu.length;
  // moves
  const cScen = new Int8Array(NC), cMode = new Int8Array(NC); // mode 1 rest only, 2 after the move only, 3 destroyed
  const list = s => (s || '').trim().split(/\s+/).filter(Boolean);
  MOVES.forEach((m, k) => {
    const mark = (s, mode) => list(s).forEach(t => {
      const c = resolve(t);
      if (c === undefined) return;
      if (cScen[c] && cScen[c] !== k + 1) console.warn('copy in two moves', t);
      cScen[c] = k + 1; cMode[c] = mode;
    });
    mark(m.rest, 1); mark(m.on, 2); mark(m.gone, 3);
    m.travelers = list(m.travel).map(s => s.split('>').map(resolve));
    m.fails = list(m.fail).map(s => s.split('>').map(resolve));
    m.cueCopies = list(m.cue).map(resolve);
  });
  // adjacency over copies: interactions (type 0) and identity links (type 1)
  const cnt = new Int32Array(NC + 1);
  const all = [];
  for (let e = 0; e < E; e++) all.push([eu[e], ev[e], 0]);
  for (let e = 0; e < I; e++) all.push([iu[e], iv[e], 1]);
  for (const [a, b] of all) { cnt[a + 1]++; cnt[b + 1]++; }
  for (let i = 0; i < NC; i++) cnt[i + 1] += cnt[i];
  const adjS = cnt.slice(), adj = new Int32Array(2 * all.length), adjT = new Int8Array(2 * all.length), fill = cnt.slice(0, NC);
  for (const [a, b, t] of all) { adj[fill[a]] = b; adjT[fill[a]++] = t; adj[fill[b]] = a; adjT[fill[b]++] = t; }
  const cDeg = new Int32Array(NC);
  for (let e = 0; e < E; e++) { cDeg[eu[e]]++; cDeg[ev[e]]++; }
  const partners = Array.from({ length: P }, () => new Set());
  for (let e = 0; e < E; e++) { partners[cProt[eu[e]]].add(cProt[ev[e]]); partners[cProt[ev[e]]].add(cProt[eu[e]]); }
  const pDeg = new Int32Array(P);
  partners.forEach((s, p) => { pDeg[p] = s.size; });
  const pOrd = Array.from({ length: P }, (_, i) => i).sort((a, b) => pDeg[b] - pDeg[a] || a - b);
  const maxDeg = Math.max(...pDeg), maxCDeg = Math.max(...cDeg);
  return { PK, placeIdx, contact, P, NC, E, I, sym, name, role, pPlaces, pCopies, index, cProt, cPlace, cHint, copyOf,
    resolve, eu, ev, iu, iv, cScen, cMode, adjS, adj, adjT, cDeg, partners, pDeg, pOrd, maxDeg, maxCDeg };
})();
const A = s => NET.index.get(s);   // protein index from its symbol
const CP = s => NET.resolve(s);    // copy index from 'SYM' or 'SYM@place'

// ---------------------------------------------------------------- the cell --
// An illustrative human cell, about 20 micrometres across, scaled to radius 1.
const CELL = (() => {
  const rng = mulberry(17);
  const pm = [1.0, 0.8, 0.94];                         // plasma membrane: a slightly flattened ellipsoid
  const nuc = { c: [-0.12, 0.0, -0.05], r: 0.34 };     // nucleus
  const nucl = { c: [-0.035, 0.075, 0.025], r: 0.095 }; // nucleolus, inside it
  const gdir = v3.norm([0.55, 0.3, 0.62]);             // the Golgi sits on this side of the nucleus
  const er = { r: [0.41, 0.455, 0.5] };                // ER sheets wrapped around the nucleus
  const golgi = { r: [0.575, 0.605, 0.635, 0.665, 0.695], ang: [0.36, 0.34, 0.31, 0.28, 0.24] };
  const centro = v3.add(nuc.c, v3.mul(gdir, 0.53));   // centrosome, where microtubules start
  const eScale = p => Math.sqrt((p[0] / pm[0]) ** 2 + (p[1] / pm[1]) ** 2 + (p[2] / pm[2]) ** 2);
  // ER sheet pattern: the same formula is used in the ER shader
  const erMask = (d, k) => {
    const a = Math.sin(5.3 * d[0] + 1.7 * k + 0.3) * Math.sin(4.1 * d[1] - 0.9 * k + 1.1) * Math.sin(4.7 * d[2] + 2.3 * k + 0.5);
    const b = Math.sin(9.1 * d[0] - 6.3 * d[2] + 3.1 * k) * Math.sin(7.7 * d[1] + 5.2 * d[0] - 1.3 * k);
    const g = v3.dot(d, gdir);
    return a + 0.45 * b + 0.18 - Math.max(0, g - 0.72) * 6;
  };
  // free spots in the cytoplasm for organelles
  const spots = [];
  const okSpot = (p, r) => {
    const e = eScale(p);
    if (e > 0.9 - r * 1.2) return false;
    const dn = v3.len(v3.sub(p, nuc.c));
    if (dn < 0.56 + r) return false;
    const dg = v3.sub(p, nuc.c), ang = Math.acos(clamp(v3.dot(v3.norm(dg), gdir), -1, 1));
    if (ang < 0.5 && dn < 0.8) return false;
    return spots.every(s => v3.len(v3.sub(s.c, p)) > s.r + r + 0.05);
  };
  const place = (n, r, rmin, rmax, tries) => {
    const out = [];
    for (let t = 0; t < tries && out.length < n; t++) {
      const z = rng() * 2 - 1, th = rng() * Math.PI * 2, s = Math.sqrt(1 - z * z);
      const rr = rmin + (rmax - rmin) * rng();
      const p = [s * Math.cos(th) * rr * pm[0], z * rr * pm[1], s * Math.sin(th) * rr * pm[2]];
      if (!okSpot(p, r)) continue;
      const o = { c: p, r };
      spots.push(o); out.push(o);
    }
    return out;
  };
  // mitochondria: elongated, lying across the radial direction
  const mitos = place(7, 0.12, 0.55, 0.86, 4000).map(o => {
    const radial = v3.norm(o.c), t = perp(radial), b = v3.cross(radial, t), a = rng() * Math.PI;
    const axis = v3.norm(v3.add(v3.mul(t, Math.cos(a)), v3.mul(b, Math.sin(a))));
    return { c: o.c, axis, a: 0.115 + 0.03 * rng(), b: 0.036 };
  });
  const lysos = place(7, 0.05, 0.5, 0.78, 4000).map(o => ({ c: o.c, r: 0.044 + 0.01 * rng() }));
  const endos = place(8, 0.045, 0.62, 0.92, 4000).map(o => ({ c: o.c, r: 0.038 + 0.01 * rng() }));
  const peroxs = place(5, 0.035, 0.5, 0.88, 4000).map(o => ({ c: o.c, r: 0.03 }));
  // nuclear pores: evenly spread over the envelope
  const pores = [];
  const NP = 44, ga = Math.PI * (3 - Math.sqrt(5));
  for (let i = 0; i < NP; i++) {
    const y = 1 - 2 * (i + 0.5) / NP, s = Math.sqrt(1 - y * y), th = ga * i + 0.4;
    pores.push(v3.norm([Math.cos(th) * s, y, Math.sin(th) * s]));
  }
  // microtubules: from the centrosome out to the cell edge, bending around the nucleus
  const mts = [];
  for (let i = 0; i < 34; i++) {
    const z = 1 - 2 * (i + 0.5) / 34, s = Math.sqrt(1 - z * z), th = ga * i * 1.3 + 1.1;
    const d = v3.norm([Math.cos(th) * s, z * 0.8, Math.sin(th) * s]);
    if (v3.dot(d, v3.norm(v3.sub(nuc.c, centro))) > 0.55) continue;
    const pts = [centro.slice()];
    let p = centro.slice(), dir = d;
    for (let k = 0; k < 40; k++) {
      p = v3.add(p, v3.mul(dir, 0.045));
      const off = v3.sub(p, nuc.c), dn = v3.len(off);
      if (dn < 0.53) p = v3.add(nuc.c, v3.mul(off, 0.53 / dn)); // slide around the nucleus and its ER
      dir = v3.norm(v3.add(dir, v3.mul(v3.norm(v3.sub(p, nuc.c)), 0.12)));
      pts.push(p.slice());
      if (eScale(p) > 0.93) break;
    }
    if (pts.length > 4) mts.push(pts);
  }
  return { pm, nuc, nucl, gdir, er, golgi, centro, erMask, eScale, mitos, lysos, endos, peroxs, pores, mts };
})();

// ------------------------------------------------------------------ layout --
// Places every copy where it belongs (on a membrane, inside an organelle, in the
// cytoplasm), with interacting proteins pulled together. Seeded, so the cell
// looks the same on every visit.
const LAYOUT = (() => {
  const { NC, cPlace, cHint, cProt, eu, ev, iu, iv, PK } = NET;
  const K = PK.reduce((o, k, i) => (o[k] = i, o), {});
  const rng = mulberry(5);
  const pos = new Float32Array(NC * 3);
  const inst = new Int32Array(NC).fill(-1); // which mitochondrion / lysosome / vesicle / peroxisome
  const multi = { [K.mito]: CELL.mitos, [K.lyso]: CELL.lysos, [K.endo]: CELL.endos, [K.perox]: CELL.peroxs };
  const randDir = () => { const z = rng() * 2 - 1, t = rng() * Math.PI * 2, s = Math.sqrt(1 - z * z); return [s * Math.cos(t), z, s * Math.sin(t)]; };
  const { nuc, nucl, er, golgi, gdir, pm } = CELL;
  const toEll = (p, s) => { const e = CELL.eScale(p) || 1; return v3.mul(p, s / e); };
  // keeps p inside the cytoplasm: inside the membrane, outside the nucleus and its ER
  const cytoClamp = p => {
    let q = p;
    if (CELL.eScale(q) > 0.92) q = toEll(q, 0.92);
    const off = v3.sub(q, nuc.c), d = v3.len(off);
    if (d < 0.56) q = v3.add(nuc.c, v3.mul(off, 0.56 / (d || 1)));
    return q;
  };
  // all microtubule segments in one flat array: ax ay az bx by bz
  const SEG = [];
  CELL.mts.forEach(m => { for (let k = 0; k < m.length - 1; k++) SEG.push(...m[k], ...m[k + 1]); });
  const nearestOnMT = p => {
    let bx = 0, by = 0, bz = 0, bd = Infinity;
    for (let o = 0; o < SEG.length; o += 6) {
      const ax = SEG[o], ay = SEG[o + 1], az = SEG[o + 2], ux = SEG[o + 3] - ax, uy = SEG[o + 4] - ay, uz = SEG[o + 5] - az;
      const t = clamp(((p[0] - ax) * ux + (p[1] - ay) * uy + (p[2] - az) * uz) / (ux * ux + uy * uy + uz * uz || 1), 0, 1);
      const qx = ax + ux * t, qy = ay + uy * t, qz = az + uz * t, d = (p[0] - qx) ** 2 + (p[1] - qy) ** 2 + (p[2] - qz) ** 2;
      if (d < bd) { bd = d; bx = qx; by = qy; bz = qz; }
    }
    return [bx, by, bz];
  };
  // project a copy onto its place; free = before organelles are assigned
  const project = (c, p, free) => {
    const pl = cPlace[c], h = cHint[c];
    if (pl === K.ext) return toEll(p, 1.075);
    if (pl === K.pm) return toEll(p, 1.0);
    if (pl === K.cyto) return cytoClamp(p);
    if (pl === K.cytosk) {
      if (h === 'actin') return toEll(p, 0.945);
      return nearestOnMT(p);
    }
    if (pl === K.nuc) {
      let off = v3.sub(p, nuc.c), d = v3.len(off);
      let q = d > 0.3 ? v3.add(nuc.c, v3.mul(off, 0.3 / d)) : p;
      const o2 = v3.sub(q, nucl.c), d2 = v3.len(o2);
      if (d2 < nucl.r + 0.025) q = v3.add(nucl.c, v3.mul(o2, (nucl.r + 0.025) / (d2 || 1)));
      return q;
    }
    if (pl === K.nucl) {
      const off = v3.sub(p, nucl.c), d = v3.len(off);
      return d > nucl.r * 0.78 ? v3.add(nucl.c, v3.mul(off, nucl.r * 0.78 / d)) : p;
    }
    if (pl === K.ne) {
      const r = nuc.r + (h === 'in' ? -0.016 : h === 'out' ? 0.016 : 0);
      return v3.add(nuc.c, v3.mul(v3.norm(v3.sub(p, nuc.c)), r));
    }
    if (pl === K.er) {
      const off = v3.sub(p, nuc.c), d = v3.len(off), dir = v3.norm(off);
      let k = 0;
      for (let j = 1; j < er.r.length; j++) if (Math.abs(er.r[j] - d) < Math.abs(er.r[k] - d)) k = j;
      return v3.add(nuc.c, v3.mul(dir, er.r[k]));
    }
    if (pl === K.golgi) {
      const off = v3.sub(p, nuc.c), d = v3.len(off);
      let k = 0;
      for (let j = 1; j < golgi.r.length; j++) if (Math.abs(golgi.r[j] - d) < Math.abs(golgi.r[k] - d)) k = j;
      let dir = v3.norm(off);
      const ang = Math.acos(clamp(v3.dot(dir, gdir), -1, 1)), lim = golgi.ang[k] * 0.85;
      if (ang > lim) {
        const side = v3.norm(v3.sub(dir, v3.mul(gdir, v3.dot(dir, gdir))));
        dir = v3.add(v3.mul(gdir, Math.cos(lim)), v3.mul(side, Math.sin(lim)));
      }
      return v3.add(nuc.c, v3.mul(dir, golgi.r[k]));
    }
    const list = multi[pl];
    if (list) {
      if (free || inst[c] < 0) return cytoClamp(p);
      const o = list[inst[c]], inside = h === 'in';
      if (pl === K.mito) {
        // ellipsoid along o.axis
        const off = v3.sub(p, o.c), ax = v3.dot(off, o.axis), rad = v3.sub(off, v3.mul(o.axis, ax));
        let rl = v3.len(rad), rd = rl > 1e-6 ? v3.mul(rad, 1 / rl) : perp(o.axis);
        const s = inside ? 0.55 : 1.0;
        // point on the ellipsoid in the same "direction" in scaled coordinates
        let u = ax / o.a, w = rl / o.b;
        const n = Math.hypot(u, w) || 1;
        u = u / n * s; w = w / n * s;
        if (inside) { u = clamp(ax / o.a, -0.75, 0.75); w = Math.min(rl / o.b, 0.5); }
        return v3.add(o.c, v3.add(v3.mul(o.axis, u * o.a), v3.mul(rd, w * o.b)));
      }
      const off = v3.sub(p, o.c), d = v3.len(off) || 1;
      const r = inside ? o.r * 0.45 : o.r;
      if (inside && d < r) return p;
      return v3.add(o.c, v3.mul(off, r / d));
    }
    return p;
  };
  // starting points
  const P = [];
  for (let c = 0; c < NC; c++) {
    const pl = cPlace[c];
    let p;
    if (pl === K.nuc || pl === K.nucl || pl === K.ne || pl === K.er || pl === K.golgi) p = v3.add(nuc.c, v3.mul(randDir(), 0.2 + 0.3 * rng()));
    else p = v3.mul(randDir(), 0.6 + 0.3 * rng());
    if (pl === K.golgi) p = v3.add(nuc.c, v3.mul(v3.norm(v3.add(gdir, v3.mul(randDir(), 0.25))), 0.63));
    if (pl === K.er) {
      let d = randDir(), k = Math.floor(rng() * 3);
      for (let t = 0; t < 200 && CELL.erMask(d, k) < 0.25; t++) d = randDir();
      p = v3.add(nuc.c, v3.mul(d, er.r[k]));
    }
    P.push(project(c, p, true));
  }
  const edges = [];
  for (let e = 0; e < eu.length; e++) edges.push([eu[e], ev[e], cPlace[eu[e]] === cPlace[ev[e]] ? 0.05 : 0.065, 1]);
  for (let e = 0; e < iu.length; e++) edges.push([iu[e], iv[e], 0.18, 0.04]);
  const X = new Float64Array(NC * 3), F = new Float64Array(NC * 3);
  const sync = () => { for (let c = 0; c < NC; c++) { X[3 * c] = P[c][0]; X[3 * c + 1] = P[c][1]; X[3 * c + 2] = P[c][2]; } };
  const relax = (iters, free, step0) => {
    sync();
    const R = 0.075, R2 = R * R;
    for (let it = 0; it < iters; it++) {
      const step = step0 * (1 - it / iters) + 0.004;
      F.fill(0);
      for (const [a, b, L, k] of edges) {
        const dx = X[3 * b] - X[3 * a], dy = X[3 * b + 1] - X[3 * a + 1], dz = X[3 * b + 2] - X[3 * a + 2];
        const l = Math.sqrt(dx * dx + dy * dy + dz * dz) || 1e-6, f = k * (l - L) / l;
        F[3 * a] += dx * f; F[3 * a + 1] += dy * f; F[3 * a + 2] += dz * f;
        F[3 * b] -= dx * f; F[3 * b + 1] -= dy * f; F[3 * b + 2] -= dz * f;
      }
      for (let a = 0; a < NC; a++) {
        const ax = X[3 * a], ay = X[3 * a + 1], az = X[3 * a + 2];
        for (let b = a + 1; b < NC; b++) {
          const dx = X[3 * b] - ax, dy = X[3 * b + 1] - ay, dz = X[3 * b + 2] - az;
          const d2 = dx * dx + dy * dy + dz * dz;
          if (d2 > R2) continue;
          const d = Math.sqrt(d2) || 1e-4, f = 0.6 * (R - d) / d;
          F[3 * a] -= dx * f; F[3 * a + 1] -= dy * f; F[3 * a + 2] -= dz * f;
          F[3 * b] += dx * f; F[3 * b + 1] += dy * f; F[3 * b + 2] += dz * f;
        }
      }
      for (let c = 0; c < NC; c++) {
        const fx = F[3 * c], fy = F[3 * c + 1], fz = F[3 * c + 2], l = Math.sqrt(fx * fx + fy * fy + fz * fz), s = l > step ? step / l : 1;
        const q = project(c, [X[3 * c] + fx * s, X[3 * c + 1] + fy * s, X[3 * c + 2] + fz * s], free);
        X[3 * c] = q[0]; X[3 * c + 1] = q[1]; X[3 * c + 2] = q[2];
      }
    }
    for (let c = 0; c < NC; c++) P[c] = [X[3 * c], X[3 * c + 1], X[3 * c + 2]];
  };
  relax(160, true, 0.05);
  // give each group of copies in a multi-organelle place its own organelle
  const together = new Map();
  TOGETHER.forEach((g, gi) => g.split(/\s+/).forEach(t => { const c = CP(t); if (c !== undefined) together.set(c, gi); }));
  for (const pl of Object.keys(multi).map(Number)) {
    const cs = [];
    for (let c = 0; c < NC; c++) if (cPlace[c] === pl) cs.push(c);
    const par = new Map(cs.map(c => [c, c]));
    const find = x => { while (par.get(x) !== x) x = par.get(x); return x; };
    const join = (a, b) => { const ra = find(a), rb = find(b); if (ra !== rb) par.set(ra, rb); };
    for (let e = 0; e < eu.length; e++) if (cPlace[eu[e]] === pl && cPlace[ev[e]] === pl) join(eu[e], ev[e]);
    const byG = new Map();
    for (const c of cs) if (together.has(c)) { const g = together.get(c); if (byG.has(g)) join(byG.get(g), c); else byG.set(g, c); }
    const groups = new Map();
    for (const c of cs) { const r = find(c); if (!groups.has(r)) groups.set(r, []); groups.get(r).push(c); }
    const gl = [...groups.values()].sort((x, y) => y.length - x.length);
    const used = new Set(), list = multi[pl];
    for (const g of gl) {
      const cen = v3.mul(g.reduce((s, c) => v3.add(s, P[c]), [0, 0, 0]), 1 / g.length);
      let best = -1, bd = Infinity;
      list.forEach((o, i) => { const d = v3.len(v3.sub(o.c, cen)) + (used.has(i) ? 10 : 0); if (d < bd) { bd = d; best = i; } });
      used.add(best);
      g.forEach(c => { inst[c] = best; P[c] = v3.add(list[best].c, v3.mul(randDir(), 0.02)); });
    }
  }
  relax(220, false, 0.03);
  // ER proteins sit on the sheets, not in the holes between them: move each to the nearest sheet point
  for (let c = 0; c < NC; c++) {
    if (cPlace[c] !== K.er) continue;
    const dir0 = v3.norm(v3.sub(P[c], nuc.c));
    let best = null, bd = Infinity;
    for (let k = 0; k < er.r.length; k++) {
      for (let t = 0; t < 160; t++) {
        const jit = t ? v3.norm(v3.add(dir0, v3.mul(randDir(), 0.02 + 0.004 * t))) : dir0;
        if (CELL.erMask(jit, k) < 0.3) continue;
        const q = v3.add(nuc.c, v3.mul(jit, er.r[k])), dd = v3.len(v3.sub(q, P[c]));
        if (dd < bd) { bd = dd; best = q; }
        break;
      }
    }
    if (best) P[c] = best;
  }
  // nuclear pore proteins sit in two neighbouring pores, each at its depth
  const poreCs = [];
  for (let c = 0; c < NC; c++) if (cPlace[c] === K.ne && cHint[c].startsWith('pore')) poreCs.push(c);
  let usePores = [];
  if (poreCs.length) {
    const cen = v3.norm(poreCs.reduce((s, c) => v3.add(s, v3.sub(P[c], nuc.c)), [0, 0, 0]));
    const ord = CELL.pores.map((d, i) => [v3.dot(d, cen), i]).sort((x, y) => y[0] - x[0]);
    usePores = [ord[0][1], ord[1][1]];
    poreCs.forEach((c, k) => {
      const d = CELL.pores[usePores[k % 2]], t = perp(d), b = v3.cross(d, t), a = (k >> 1) * 2.1 + (k % 2) * 0.7;
      const depth = cHint[c] === 'pore-in' ? -0.02 : cHint[c] === 'pore-out' ? 0.02 : 0;
      P[c] = v3.add(v3.add(nuc.c, v3.mul(d, nuc.r + depth)), v3.add(v3.mul(t, 0.013 * Math.cos(a)), v3.mul(b, 0.013 * Math.sin(a))));
    });
  }
  for (let c = 0; c < NC; c++) { pos[3 * c] = P[c][0]; pos[3 * c + 1] = P[c][1]; pos[3 * c + 2] = P[c][2]; }
  return { pos, inst, pores: usePores };
})();

// positions of the copies, plus their direction and distance from the cell centre
const POS = LAYOUT.pos;
NET.D = new Float32Array(NET.NC * 3); NET.R = new Float32Array(NET.NC);
for (let c = 0; c < NET.NC; c++) {
  const x = POS[3 * c], y = POS[3 * c + 1], z = POS[3 * c + 2], r = Math.hypot(x, y, z) || 1;
  NET.R[c] = r; NET.D[3 * c] = x / r; NET.D[3 * c + 1] = y / r; NET.D[3 * c + 2] = z / r;
}
const cpos = c => [POS[3 * c], POS[3 * c + 1], POS[3 * c + 2]];
function nodePos(c, h, out) { return out.set(POS[3 * c], POS[3 * c + 1], POS[3 * c + 2]); }
const latLonOf = p => { const r = v3.len(p) || 1; return [Math.asin(clamp(p[1] / r, -1, 1)) / D2R, Math.atan2(-p[2] / r, p[0] / r) / D2R]; };
const PLACE_COL = PLACES.map(p => p[3]);
const placeCss = k => 'rgb(' + PLACE_COL[k].map(v => Math.round(v * 255)).join(',') + ')';

// -------------------------------------------------------------- curves --
// the centre of the shape a copy sits on, so lines along a membrane bulge with it
function shapeCentre(c) {
  const pl = NET.PK[NET.cPlace[c]], i = LAYOUT.inst[c];
  if (pl === 'nuc' || pl === 'nucl' || pl === 'ne' || pl === 'er' || pl === 'golgi') return CELL.nuc.c;
  if (pl === 'mito') return CELL.mitos[i].c;
  if (pl === 'lyso') return CELL.lysos[i].c;
  if (pl === 'endo') return CELL.endos[i].c;
  if (pl === 'perox') return CELL.peroxs[i].c;
  if (pl === 'pm' || pl === 'ext' || pl === 'cytosk') return [0, 0, 0];
  return null;
}
function bezier(p0, p1, p2, n) {
  const out = new Float32Array((n + 1) * 3);
  for (let k = 0; k <= n; k++) {
    const t = k / n, a = (1 - t) * (1 - t), b = 2 * (1 - t) * t, c = t * t;
    for (let j = 0; j < 3; j++) out[3 * k + j] = a * p0[j] + b * p1[j] + c * p2[j];
  }
  return out;
}
// Catmull-Rom through a few points
function spline(pts, n) {
  const out = new Float32Array((n + 1) * 3), m = pts.length - 1;
  for (let k = 0; k <= n; k++) {
    const u = k / n * m, i = Math.min(m - 1, Math.floor(u)), t = u - i;
    const p0 = pts[Math.max(0, i - 1)], p1 = pts[i], p2 = pts[i + 1], p3 = pts[Math.min(m, i + 2)];
    for (let j = 0; j < 3; j++) {
      out[3 * k + j] = 0.5 * ((2 * p1[j]) + (-p0[j] + p2[j]) * t + (2 * p0[j] - 5 * p1[j] + 4 * p2[j] - p3[j]) * t * t + (-p0[j] + 3 * p1[j] - 3 * p2[j] + p3[j]) * t * t * t);
    }
  }
  return out;
}
const inNucleus = c => { const k = NET.PK[NET.cPlace[c]]; return k === 'nuc' || k === 'nucl'; };
// an interaction: a gentle curve that follows the membrane both proteins sit on
function edgeCurve(a, b, n) {
  const pa = cpos(a), pb = cpos(b), mid = v3.lerp(pa, pb, 0.5), L = v3.len(v3.sub(pb, pa));
  const ca = shapeCentre(a), cb = shapeCentre(b);
  let ctr = null;
  if (ca && cb && ca === cb) ctr = ca;
  else if (NET.cPlace[a] === NET.cPlace[b] && ca) ctr = ca;
  if (!ctr) return bezier(pa, mid, pb, n);
  let off = v3.sub(mid, ctr);
  if (v3.len(off) < 1e-4) off = perp(v3.norm(v3.sub(pb, pa)));
  return bezier(pa, v3.add(mid, v3.mul(v3.norm(off), L * 0.2)), pb, n);
}
// the nuclear pore nearest to a trip into or out of the nucleus
function poreFor(outside, inside) {
  const nc = CELL.nuc.c;
  let best = 0, bd = Infinity;
  CELL.pores.forEach((d, i) => {
    const p = v3.add(nc, v3.mul(d, CELL.nuc.r)), s = v3.len(v3.sub(p, outside)) + v3.len(v3.sub(p, inside));
    if (s < bd) { bd = s; best = i; }
  });
  return CELL.pores[best];
}
// the way a protein travels between two of its places: through a nuclear pore
// when it enters or leaves the nucleus, otherwise a simple arc
function travelCurve(a, b, n) {
  const pa = cpos(a), pb = cpos(b), ia = inNucleus(a), ib = inNucleus(b);
  const ka = NET.PK[NET.cPlace[a]], kb = NET.PK[NET.cPlace[b]];
  if (ia !== ib && ka !== 'ne' && kb !== 'ne') {
    const out = ia ? pb : pa, inn = ia ? pa : pb, d = poreFor(out, inn), nc = CELL.nuc.c, r = CELL.nuc.r;
    const po = v3.add(nc, v3.mul(d, r + 0.06)), pi = v3.add(nc, v3.mul(d, r - 0.05));
    return spline(ia ? [pa, pi, po, pb] : [pa, po, pi, pb], n);
  }
  const mid = v3.lerp(pa, pb, 0.5), L = v3.len(v3.sub(pb, pa));
  let off = mid;
  if (v3.len(off) < 1e-3) off = perp(v3.norm(v3.sub(pb, pa)));
  return bezier(pa, v3.add(mid, v3.mul(v3.norm(off), L * 0.18)), pb, n);
}
const linkCurve = (a, b, n) => (NET.cProt[a] === NET.cProt[b] ? travelCurve(a, b, n) : edgeCurve(a, b, n));
const isIdentity = (a, b) => NET.cProt[a] === NET.cProt[b];

// tubes along curves, for highlighted paths and partners
function tubeGeometry(pairs, radius, hops, seed) {
  const sides = 8, rng = mulberry(seed || 1);
  const curves = pairs.map(([u, v]) => linkCurve(u, v, isIdentity(u, v) ? 40 : 18));
  const SJ = 10, SK = 6, joints = [];
  if (hops) {
    joints.push([pairs[0][0], hops[0], 0]);
    pairs.forEach(([, v], e) => joints.push([v, hops[e], 1]));
  }
  let nv = 0, ni = 0;
  for (const a of curves) { const m = a.length / 3; nv += m * sides; ni += (m - 1) * sides * 6; }
  nv += joints.length * (SK + 1) * (SJ + 1); ni += joints.length * SK * SJ * 6;
  const pos = new Float32Array(nv * 3), aT = new Float32Array(nv), aHop = new Float32Array(nv), aRv = new Float32Array(nv);
  const idx = new Uint32Array(ni);
  let vo = 0, io = 0;
  const T = new THREE.Vector3(), N = new THREE.Vector3(), B = new THREE.Vector3(), tmp = new THREE.Vector3();
  curves.forEach((a, e) => {
    const m = a.length / 3, rv = rng(), hop = hops ? hops[e] : 1, base = vo;
    N.set(0, 0, 0);
    for (let k = 0; k < m; k++) {
      const k0 = Math.max(0, k - 1), k1 = Math.min(m - 1, k + 1);
      T.set(a[3 * k1] - a[3 * k0], a[3 * k1 + 1] - a[3 * k0 + 1], a[3 * k1 + 2] - a[3 * k0 + 2]).normalize();
      if (N.lengthSq() < 0.5) { tmp.set(Math.abs(T.y) < 0.9 ? 0 : 1, Math.abs(T.y) < 0.9 ? 1 : 0, 0); N.crossVectors(T, tmp).normalize(); }
      else { N.addScaledVector(T, -N.dot(T)).normalize(); }  // carried along the curve, so the tube does not twist
      B.crossVectors(T, N);
      for (let j = 0; j < sides; j++) {
        const ang = 2 * Math.PI * j / sides, c = Math.cos(ang) * radius, s = Math.sin(ang) * radius;
        pos[3 * vo] = a[3 * k] + c * N.x + s * B.x; pos[3 * vo + 1] = a[3 * k + 1] + c * N.y + s * B.y; pos[3 * vo + 2] = a[3 * k + 2] + c * N.z + s * B.z;
        aT[vo] = k / (m - 1); aHop[vo] = hop; aRv[vo] = rv; vo++;
      }
    }
    for (let k = 0; k < m - 1; k++) for (let j = 0; j < sides; j++) {
      const a0 = base + k * sides + j, a1 = base + k * sides + (j + 1) % sides;
      idx[io++] = a0; idx[io++] = a1; idx[io++] = a1 + sides; idx[io++] = a0; idx[io++] = a1 + sides; idx[io++] = a0 + sides;
    }
  });
  const jr = radius * 1.15;
  for (const [i, hop, t] of joints) {
    const cx = POS[3 * i], cy = POS[3 * i + 1], cz = POS[3 * i + 2], base = vo;
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
// presence of a copy while moves are under way: rest-only copies fade out,
// copies that only exist after a move fade in
const GLSL_COMMON = `
uniform float uScen[8];
float presence(float sc, float md) {
  if (sc < 0.5) return 1.0;
  float s = uScen[int(sc - 0.5)];
  return (md > 1.5 && md < 2.5) ? s : 1.0 - s;
}
vec3 degRamp(float x) {
  vec3 c0 = vec3(0.12, 0.34, 1.0), c1 = vec3(0.16, 0.86, 1.0), c2 = vec3(1.0, 0.72, 0.18), c3 = vec3(1.0, 0.42, 0.12);
  if (x < 0.45) return mix(c0, c1, x / 0.45);
  if (x < 0.78) return mix(c1, c2, (x - 0.45) / 0.33);
  return mix(c2, c3, (x - 0.78) / 0.22);
}
vec3 multiCol(float m) {
  return m < 1.5 ? vec3(0.42, 0.50, 0.62) : m < 2.5 ? vec3(1.0, 0.74, 0.22) : vec3(0.22, 0.90, 0.78);
}`;
function nodeMaterial(uniforms) {
  return new THREE.ShaderMaterial({
    uniforms, transparent: true, depthWrite: false,
    vertexShader: GLSL_COMMON + `
attribute float aIdx, aProt, aRand, aPlace, aDeg, aMulti, aScen, aMode, aFocus, aSize;
uniform float uReveal, uWPlace, uWDeg, uWMulti, uFocus, uPathProg, uIso, uSel, uAlpha, uScale, uPx, uProxOn;
uniform vec4 uProx;
uniform vec3 uPal[13];
varying vec3 vCol; varying float vA, vRing;
void main() {
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * mv;
  vec3 col = vec3(0.86, 0.92, 1.0);
  col = mix(col, uPal[int(aPlace + 0.5)], uWPlace);
  col = mix(col, degRamp(aDeg), uWDeg);
  col = mix(col, multiCol(aMulti), uWMulti);
  float pres = presence(aScen, aMode);
  float gone = step(2.5, aMode) * (1.0 - pres);
  col = mix(col, vec3(1.0, 0.25, 0.18), clamp(gone * 4.0, 0.0, 1.0));
  float onPath = step(0.5, aFocus);
  float reached = onPath * clamp((uPathProg - aFocus + 1.35) / 0.35, 0.0, 1.0);
  float bright = mix(1.0, 0.24 + reached * 1.4, uFocus);
  float inProx = 1.0 - smoothstep(uProx.w * 0.94, uProx.w, distance(position, uProx.xyz));
  bright *= mix(1.0, 0.22 + 1.3 * inProx, uProxOn);
  float iso = uIso < -0.5 ? 1.0 : (abs(aPlace - uIso) < 0.5 ? 1.0 : 0.12);
  float sel = 1.0 - step(0.5, abs(aProt - uSel));
  float reveal = clamp((uReveal * 1.12 - aRand) / 0.12, 0.0, 1.0);
  vCol = col * bright; vRing = sel;
  vA = reveal * iso * uAlpha * clamp(pres + gone, 0.0, 1.0) * smoothstep(0.0, 0.15, pres);
  float att = uPx > 0.0 ? uPx * projectionMatrix[1][1] / max(-mv.z, 0.05) : 1.0;
  gl_PointSize = max(aSize * uScale * att * (1.0 + sel * 1.2) * (1.0 + 0.6 * uFocus * reached) * (1.0 + 0.5 * uProxOn * inProx), uPx > 0.0 ? 1.6 : 0.0);
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
// interactions: lines coloured by the place where they happen, white across a boundary
function routeMaterial(uniforms) {
  return new THREE.ShaderMaterial({
    uniforms, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    vertexShader: GLSL_COMMON + `
attribute float aT, aRv, aPlA, aPlB, aScA, aMdA, aScB, aMdB;
attribute vec3 aCol;
uniform float uReveal, uAlpha, uWPlace, uIso, uFocus, uProxOn;
uniform vec3 uBase;
varying vec3 vCol; varying float vA;
void main() {
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  float g = clamp((uReveal - aRv * 0.75) / 0.25, 0.0, 1.0);
  float vis = step(0.0001, g) * step(aT, g + 0.0005);
  vec3 col = mix(uBase, aCol, uWPlace);
  float pa = presence(aScA, aMdA), pb = presence(aScB, aMdB);
  // a lost interaction flashes red as it fades
  float restA = (aScA > 0.5 && (aMdA < 1.5 || aMdA > 2.5)) ? 1.0 - pa : 0.0;
  float restB = (aScB > 0.5 && (aMdB < 1.5 || aMdB > 2.5)) ? 1.0 - pb : 0.0;
  col = mix(col, vec3(1.0, 0.2, 0.14), clamp(max(restA, restB) * 3.0, 0.0, 1.0));
  float iso = uIso < -0.5 ? 1.0 : ((abs(aPlA - uIso) < 0.5 || abs(aPlB - uIso) < 0.5) ? 1.0 : 0.05);
  vCol = col;
  vA = vis * uAlpha * pa * pb * iso * (1.0 - 0.75 * uFocus) * (1.0 - 0.6 * uProxOn);
}`,
    fragmentShader: `
varying vec3 vCol; varying float vA;
void main() { gl_FragColor = vec4(vCol, vA); }`,
  });
}
// identity links: dotted lines between the copies of one protein
function idMaterial(uniforms) {
  return new THREE.ShaderMaterial({
    uniforms, transparent: true, depthWrite: false,
    vertexShader: GLSL_COMMON + `
attribute float aT, aLen, aPlA, aPlB, aScA, aMdA, aScB, aMdB, aProt;
uniform float uReveal, uAlpha, uIso, uSel, uFocus;
varying float vA, vD;
void main() {
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  float vis = step(aT, uReveal + 0.0005) * step(0.0001, uReveal);
  float iso = uIso < -0.5 ? 1.0 : ((abs(aPlA - uIso) < 0.5 || abs(aPlB - uIso) < 0.5) ? 1.0 : 0.08);
  float sel = 1.0 - step(0.5, abs(aProt - uSel));
  vD = aT * aLen * 70.0;
  vA = vis * uAlpha * presence(aScA, aMdA) * presence(aScB, aMdB) * iso * (1.0 - 0.7 * uFocus) * (1.0 + sel);
}`,
    fragmentShader: `
varying float vA, vD;
void main() {
  if (fract(vD) > 0.55) discard;
  gl_FragColor = vec4(1.0, 0.88, 0.62, min(vA, 1.0));
}`,
  });
}
// signals and paths: teal, and see-through (fade) so the cell shows through them
const SIG = [0.22, 0.90, 0.78], SIG_A = 0.6, SIG_DOT = [0.36, 1.0, 0.88];
function highlightMaterial(color, stepped, spread, fade) {
  return new THREE.ShaderMaterial({
    side: THREE.DoubleSide,
    uniforms: { uProg: { value: 0 }, uAlpha: { value: 0 }, uColor: { value: new THREE.Color(...color) },
      uStepped: { value: stepped ? 1 : 0 }, uSpread: { value: spread || 0 }, uK: { value: fade || 1 } },
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
uniform float uAlpha, uK; uniform vec3 uColor;
varying float vT, vG;
void main() {
  if (vT > vG + 0.0005) discard;
  float head = (1.0 - smoothstep(0.0, 0.05, vG - vT)) * step(vG, 0.999);
  gl_FragColor = vec4(uColor * (1.0 + head * 1.4), uAlpha * mix(uK, 1.0, head));
}`,
  });
}
// translucent organelle skins, lit from the viewer's side with a bright rim
function shellMaterial(rgb, a0, a1, kind) {
  const defs = kind === 'er' ? '#define ER\n' : kind === 'mito' ? '#define MITO\n' : '';
  return new THREE.ShaderMaterial({
    uniforms: { uL: { value: new THREE.Vector3(0, 0, 1) }, uA: { value: 1 }, uK: { value: 0 }, uLen: { value: 1 },
      uG: { value: new THREE.Vector3(...CELL.gdir) } },
    transparent: true, depthWrite: false, side: THREE.DoubleSide,
    vertexShader: `varying vec3 vN, vW, vO;
void main() { vO = position; vN = normalize((modelMatrix * vec4(normal, 0.0)).xyz); vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`,
    fragmentShader: defs + `uniform vec3 uL, uG; uniform float uA, uK, uLen; varying vec3 vN, vW, vO;
void main() {
  vec3 n = normalize(vN), v = normalize(cameraPosition - vW);
  float rim = pow(1.0 - abs(dot(n, v)), 2.5);
  float lit = 0.75 + 0.25 * max(dot(n, uL), 0.0);
  float a = ${a0} + ${a1} * rim;
  vec3 col = vec3(${rgb}) * lit;
#ifdef ER
  vec3 d = normalize(vO);
  float k = uK;
  float m = sin(5.3 * d.x + 1.7 * k + 0.3) * sin(4.1 * d.y - 0.9 * k + 1.1) * sin(4.7 * d.z + 2.3 * k + 0.5)
    + 0.45 * sin(9.1 * d.x - 6.3 * d.z + 3.1 * k) * sin(7.7 * d.y + 5.2 * d.x - 1.3 * k) + 0.18 - max(0.0, dot(d, uG) - 0.72) * 6.0;
  float sheet = smoothstep(0.0, 0.06, m);
  if (sheet < 0.01) discard;
  float edge = 1.0 - smoothstep(0.06, 0.24, m);
  a = (a + 0.07 * edge) * sheet;
  col += vec3(0.2, 0.45, 0.3) * edge * 0.35;
#endif
#ifdef MITO
  float x = vO.x / uLen;
  float crista = 1.0 - smoothstep(0.0, 0.16, abs(fract(x * 4.5 + 0.5) - 0.5) * 2.0);
  a += 0.16 * crista * (1.0 - abs(x));
  col += vec3(0.4, 0.15, 0.1) * crista;
#endif
  gl_FragColor = vec4(col, a * uA);
}`,
  });
}
function actorMaterial() {
  return new THREE.ShaderMaterial({
    uniforms: { uScale: { value: 1 }, uPx: { value: 0 } }, transparent: true, depthWrite: false, depthTest: false,
    vertexShader: `attribute vec3 aCol; attribute float aA;
uniform float uScale, uPx; varying vec3 vCol; varying float vA;
void main() {
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * mv;
  vCol = aCol; vA = aA;
  float att = uPx > 0.0 ? uPx * projectionMatrix[1][1] / max(-mv.z, 0.05) : 1.0;
  gl_PointSize = 13.0 * uScale * att;
}`,
    fragmentShader: `varying vec3 vCol; varying float vA;
void main() {
  vec2 c = gl_PointCoord - 0.5; float d = length(c);
  if (d > 0.5) discard;
  float core = smoothstep(0.30, 0.18, d), glow = pow(1.0 - d * 2.0, 2.0);
  gl_FragColor = vec4(mix(vCol, vec3(1.0), core * 0.6), vA * max(core, glow * 0.7));
}`,
  });
}
function bubbleMaterial() {
  return new THREE.ShaderMaterial({
    uniforms: { uA: { value: 0 } }, transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending,
    vertexShader: `varying vec3 vN, vW; void main() { vN = normalize((modelMatrix * vec4(normal, 0.0)).xyz); vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`,
    fragmentShader: `uniform float uA; varying vec3 vN, vW;
void main() {
  vec3 n = normalize(vN), v = normalize(cameraPosition - vW);
  float rim = pow(1.0 - abs(dot(n, v)), 3.0);
  gl_FragColor = vec4(vec3(0.35, 1.0, 0.75) * (0.10 + 0.9 * rim), uA);
}`,
  });
}

// ------------------------------------------------------------------- scene --
const GL = {};
// organelles appear in this order in the story; each copy's place belongs to one of them
const ORGS = ['Plasma membrane', 'Nucleus', 'Nucleolus', 'Endoplasmic reticulum', 'Golgi apparatus', 'Mitochondria', 'Lysosomes', 'Endosomes and vesicles', 'Peroxisomes', 'Cytoskeleton'];
const ORG_OF_PLACE = { ext: 0, pm: 0, cyto: -1, cytosk: 9, nuc: 1, nucl: 2, ne: 1, er: 3, golgi: 4, mito: 5, lyso: 6, endo: 7, perox: 8 };
function buildScene(canvas) {
  const renderer = HOST.makeRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
  renderer.xr.enabled = true;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(32, 1, 0.01, 200);
  Object.assign(GL, { renderer, scene, camera, canvas });
  GL.rig = new THREE.Group(); GL.world = new THREE.Group();
  scene.add(GL.rig); GL.rig.add(GL.world);
  GL.orgMats = ORGS.map(() => []);
  GL.orgAnchor = [];
  const addMesh = (geo, mat, org, order) => {
    const m = new THREE.Mesh(geo, mat);
    m.renderOrder = order || 1;
    GL.world.add(m);
    GL.orgMats[org].push(mat);
    return m;
  };
  const Q = new THREE.Quaternion(), V = new THREE.Vector3();
  const { nuc, nucl, gdir, er, golgi } = CELL;
  // plasma membrane
  const pmGeo = new THREE.SphereGeometry(1, 128, 80);
  pmGeo.scale(...CELL.pm); pmGeo.computeVertexNormals();
  GL.globeMat = shellMaterial('0.35, 0.75, 0.95', 0.02, 0.40);
  addMesh(pmGeo, GL.globeMat, 0);
  GL.orgAnchor[0] = [0.52, 0.72, 0.36];
  // nucleus, with pores in its envelope
  const nm = addMesh(new THREE.SphereGeometry(nuc.r, 96, 64), shellMaterial('0.66, 0.54, 1.0', 0.045, 0.5), 1);
  nm.position.set(...nuc.c);
  {
    const tor = new THREE.TorusGeometry(0.0125, 0.0035, 6, 14), np = tor.attributes.position.count;
    const P = new Float32Array(np * 3 * CELL.pores.length), Nn = new Float32Array(np * 3 * CELL.pores.length), I = [];
    const ti = tor.index.array, mtx = new THREE.Matrix4(), nmx = new THREE.Matrix3();
    CELL.pores.forEach((d, k) => {
      Q.setFromUnitVectors(new THREE.Vector3(0, 0, 1), V.set(...d));
      mtx.compose(new THREE.Vector3(...v3.add(nuc.c, v3.mul(d, nuc.r))), Q, new THREE.Vector3(1, 1, 1));
      nmx.getNormalMatrix(mtx);
      const pv = new THREE.Vector3();
      for (let i = 0; i < np; i++) {
        pv.fromBufferAttribute(tor.attributes.position, i).applyMatrix4(mtx); P.set([pv.x, pv.y, pv.z], 3 * (k * np + i));
        pv.fromBufferAttribute(tor.attributes.normal, i).applyMatrix3(nmx).normalize(); Nn.set([pv.x, pv.y, pv.z], 3 * (k * np + i));
      }
      for (let i = 0; i < ti.length; i++) I.push(ti[i] + k * np);
    });
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(P, 3)); g.setAttribute('normal', new THREE.BufferAttribute(Nn, 3));
    g.setIndex(I);
    addMesh(g, shellMaterial('0.55, 0.68, 1.0', 0.35, 0.4), 1, 2);
  }
  GL.orgAnchor[1] = v3.add(nuc.c, [0.05, nuc.r * 0.95, 0.1]);
  const nl = addMesh(new THREE.SphereGeometry(nucl.r, 48, 32), shellMaterial('0.95, 0.6, 1.0', 0.12, 0.45), 2);
  nl.position.set(...nucl.c);
  GL.orgAnchor[2] = nucl.c;
  // ER: perforated sheets around the nucleus
  er.r.forEach((r, k) => {
    const mat = shellMaterial('0.3, 0.9, 0.6', 0.03, 0.24, 'er');
    mat.uniforms.uK.value = k;
    mat.side = THREE.FrontSide; // the far side hides behind the nucleus anyway, and headsets are short of fill rate
    const m = addMesh(new THREE.SphereGeometry(r, 80, 56), mat, 3);
    m.position.set(...nuc.c);
  });
  {
    // the anchor for the ER label: a point on the outer sheet, away from the Golgi
    let best = null;
    for (let i = 0; i < 400 && !best; i++) { const d = v3.norm([Math.cos(i), 0.35 + 0.3 * Math.sin(i * 1.7), Math.sin(i)]); if (CELL.erMask(d, 2) > 0.4 && v3.dot(d, gdir) < 0) best = d; }
    GL.orgAnchor[3] = v3.add(nuc.c, v3.mul(best || [-1, 0, 0], er.r[2]));
  }
  // Golgi: a stack of curved cisternae facing the nucleus
  golgi.r.forEach((r, k) => {
    const g = new THREE.SphereGeometry(r, 64, 10, 0, Math.PI * 2, 0, golgi.ang[k]);
    const m = addMesh(g, shellMaterial('1.0, 0.64, 0.25', 0.10, 0.5), 4);
    m.position.set(...nuc.c);
    m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), V.set(...gdir));
  });
  {
    const vg = new THREE.SphereGeometry(0.011, 12, 8), vr = mulberry(31), vmat = shellMaterial('1.0, 0.64, 0.25', 0.2, 0.5);
    for (let i = 0; i < 14; i++) {
      const k = Math.floor(vr() * golgi.r.length), side = perp(gdir), b = v3.cross(gdir, side), a = vr() * Math.PI * 2;
      const ang = golgi.ang[k] * (1.0 + 0.15 * vr()), dir = v3.add(v3.mul(gdir, Math.cos(ang)), v3.mul(v3.add(v3.mul(side, Math.cos(a)), v3.mul(b, Math.sin(a))), Math.sin(ang)));
      const m = addMesh(vg, vmat, 4);
      m.position.set(...v3.add(nuc.c, v3.mul(dir, golgi.r[k] + 0.01 * (vr() - 0.5))));
    }
    GL.orgAnchor[4] = v3.add(nuc.c, v3.mul(gdir, golgi.r[4] + 0.02));
  }
  // centrosome: two small centrioles at right angles
  {
    const cg = new THREE.CylinderGeometry(0.007, 0.007, 0.03, 12, 1), cm = shellMaterial('0.85, 0.9, 1.0', 0.35, 0.4);
    const c1 = addMesh(cg, cm, 9), c2 = addMesh(cg, cm, 9);
    c1.position.set(...CELL.centro); c2.position.set(...v3.add(CELL.centro, [0.012, 0.0, 0.01]));
    c2.rotation.set(Math.PI / 2, 0, 0.4);
  }
  // mitochondria with cristae
  CELL.mitos.forEach(o => {
    const g = new THREE.SphereGeometry(1, 40, 20);
    g.scale(o.a, o.b, o.b); g.computeVertexNormals();
    const mat = shellMaterial('1.0, 0.42, 0.36', 0.07, 0.5, 'mito');
    mat.uniforms.uLen.value = o.a;
    const m = addMesh(g, mat, 5);
    m.position.set(...o.c);
    m.quaternion.setFromUnitVectors(new THREE.Vector3(1, 0, 0), V.set(...o.axis));
  });
  GL.orgAnchor[5] = CELL.mitos[0].c;
  // lysosomes, endosomes and vesicles, peroxisomes
  const ball = new THREE.SphereGeometry(1, 28, 18);
  const balls = (list, rgb, a0, a1, org) => {
    const mat = shellMaterial(rgb, a0, a1);
    list.forEach(o => { const m = addMesh(ball, mat, org); m.position.set(...o.c); m.scale.setScalar(o.r); });
    GL.orgAnchor[org] = list[0].c;
  };
  balls(CELL.lysos, '1.0, 0.4, 0.78', 0.14, 0.5, 6);
  balls(CELL.endos, '0.2, 0.88, 0.82', 0.08, 0.5, 7);
  balls(CELL.peroxs, '0.78, 0.95, 0.3', 0.16, 0.5, 8);
  // cytoskeleton: microtubules from the centrosome, an actin web under the membrane
  {
    const seg = [];
    CELL.mts.forEach(m => { for (let k = 0; k < m.length - 1; k++) seg.push(...m[k], ...m[k + 1]); });
    const ar = mulberry(41);
    for (let i = 0; i < 520; i++) {
      const z = ar() * 2 - 1, t = ar() * Math.PI * 2, s = Math.sqrt(1 - z * z), d = [s * Math.cos(t), z, s * Math.sin(t)];
      const p = v3.mul(d, 1), e = CELL.eScale(p), q = v3.mul(p, (0.935 + 0.02 * ar()) / e);
      const dir = perp(v3.norm(q)), b2 = v3.cross(v3.norm(q), dir), a = ar() * Math.PI, L = 0.03 + 0.05 * ar();
      const w = v3.add(v3.mul(dir, Math.cos(a)), v3.mul(b2, Math.sin(a)));
      seg.push(...v3.sub(q, v3.mul(w, L / 2)), ...v3.add(q, v3.mul(w, L / 2)));
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(seg), 3));
    const mat = new THREE.LineBasicMaterial({ color: 0xbfd0e6, transparent: true, opacity: 0.16, depthWrite: false });
    mat.userData.base = 0.16;
    const ls = new THREE.LineSegments(g, mat);
    ls.renderOrder = 1;
    GL.world.add(ls);
    GL.orgMats[9].push(mat);
    GL.orgAnchor[9] = CELL.mts[Math.floor(CELL.mts.length / 2)][6];
  }
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

  // ------------------------------------------------ proteins
  const { NC, cProt, cPlace, cDeg, maxCDeg, cScen, cMode, pPlaces } = NET;
  const pal = PLACE_COL.map(c => new THREE.Vector3(...c));
  const scen = new Array(8).fill(0);
  const U = {
    uReveal: { value: 0 }, uWPlace: { value: 1 }, uWDeg: { value: 0 }, uWMulti: { value: 0 }, uFocus: { value: 0 }, uPathProg: { value: 0 },
    uIso: { value: -1 }, uSel: { value: -1 }, uAlpha: { value: 1 }, uScale: { value: 1 }, uPx: { value: 0 }, uProxOn: { value: 0 },
    uProx: { value: new THREE.Vector4(0, 0, 0, 0) }, uPal: { value: pal }, uScen: { value: scen },
  };
  GL.U = U;
  const rng = mulberry(1);
  const at = {
    aIdx: new Float32Array(NC), aProt: new Float32Array(NC), aRand: new Float32Array(NC), aPlace: new Float32Array(NC),
    aDeg: new Float32Array(NC), aMulti: new Float32Array(NC), aScen: new Float32Array(NC), aMode: new Float32Array(NC),
    aFocus: new Float32Array(NC), aSize: new Float32Array(NC),
  };
  const lmax = Math.log1p(NET.maxDeg);
  for (let c = 0; c < NC; c++) {
    const p = cProt[c];
    at.aIdx[c] = c; at.aProt[c] = p; at.aRand[c] = rng(); at.aPlace[c] = cPlace[c];
    at.aDeg[c] = Math.log1p(NET.pDeg[p]) / lmax; at.aMulti[c] = pPlaces[p].length;
    at.aScen[c] = cScen[c]; at.aMode[c] = cMode[c];
    at.aSize[c] = 3.0 + 5.0 * Math.sqrt(cDeg[c] / maxCDeg);
  }
  GL.attr = at;
  const pg = new THREE.BufferGeometry();
  pg.setAttribute('position', new THREE.BufferAttribute(POS, 3));
  for (const [k, v] of Object.entries(at)) pg.setAttribute(k, new THREE.BufferAttribute(v, 1));
  GL.dots = new THREE.Points(pg, nodeMaterial(U));
  GL.dots.renderOrder = 5;
  GL.world.add(GL.dots);

  // ------------------------------------------------ interactions
  const SEGS = 14;
  const lines = [];
  for (let e = 0; e < NET.E; e++) lines.push(edgeCurve(NET.eu[e], NET.ev[e], SEGS));
  const tot = lines.reduce((s, a) => s + a.length / 3, 0);
  const rp = new Float32Array(tot * 3), aT = new Float32Array(tot), aRv = new Float32Array(tot), aCol = new Float32Array(tot * 3);
  const f6 = () => new Float32Array(tot);
  const ea = { aPlA: f6(), aPlB: f6(), aScA: f6(), aMdA: f6(), aScB: f6(), aMdB: f6() };
  const ri = [], er2 = mulberry(3);
  let o = 0;
  for (let e = 0; e < NET.E; e++) {
    const a = lines[e], m = a.length / 3, u = NET.eu[e], v = NET.ev[e], rv = er2();
    const same = cPlace[u] === cPlace[v], col = same ? PLACE_COL[cPlace[u]] : [0.86, 0.9, 1.0];
    rp.set(a, o * 3);
    for (let k = 0; k < m; k++) {
      aT[o + k] = k / (m - 1); aRv[o + k] = rv; aCol.set(col, 3 * (o + k));
      ea.aPlA[o + k] = cPlace[u]; ea.aPlB[o + k] = cPlace[v];
      ea.aScA[o + k] = cScen[u]; ea.aMdA[o + k] = cMode[u]; ea.aScB[o + k] = cScen[v]; ea.aMdB[o + k] = cMode[v];
      if (k < m - 1) ri.push(o + k, o + k + 1);
    }
    o += m;
  }
  const rg = new THREE.BufferGeometry();
  rg.setAttribute('position', new THREE.BufferAttribute(rp, 3));
  rg.setAttribute('aT', new THREE.BufferAttribute(aT, 1)); rg.setAttribute('aRv', new THREE.BufferAttribute(aRv, 1));
  rg.setAttribute('aCol', new THREE.BufferAttribute(aCol, 3));
  for (const [k, v] of Object.entries(ea)) rg.setAttribute(k, new THREE.BufferAttribute(v, 1));
  rg.setIndex(ri);
  GL.RU = { uReveal: { value: 0 }, uAlpha: { value: 0 }, uWPlace: { value: 1 }, uIso: { value: -1 }, uFocus: { value: 0 }, uProxOn: { value: 0 },
    uBase: { value: new THREE.Vector3(0.45, 0.7, 1.0) }, uScen: { value: scen } };
  GL.routes = new THREE.LineSegments(rg, routeMaterial(GL.RU));
  GL.routes.renderOrder = 4;
  GL.world.add(GL.routes);

  // ------------------------------------------------ identity links
  {
    const IS = 40, curves = [];
    for (let e = 0; e < NET.I; e++) curves.push(travelCurve(NET.iu[e], NET.iv[e], IS));
    const n = curves.length * (IS + 1);
    const p = new Float32Array(n * 3), t = new Float32Array(n), len = new Float32Array(n), idx = [];
    const b = { aPlA: new Float32Array(n), aPlB: new Float32Array(n), aScA: new Float32Array(n), aMdA: new Float32Array(n), aScB: new Float32Array(n), aMdB: new Float32Array(n), aProt: new Float32Array(n) };
    curves.forEach((a, e) => {
      const u = NET.iu[e], v = NET.iv[e], base = e * (IS + 1);
      let L = 0;
      for (let k = 1; k <= IS; k++) L += Math.hypot(a[3 * k] - a[3 * k - 3], a[3 * k + 1] - a[3 * k - 2], a[3 * k + 2] - a[3 * k - 1]);
      p.set(a, base * 3);
      for (let k = 0; k <= IS; k++) {
        const i = base + k;
        t[i] = k / IS; len[i] = L;
        b.aPlA[i] = cPlace[u]; b.aPlB[i] = cPlace[v]; b.aScA[i] = cScen[u]; b.aMdA[i] = cMode[u]; b.aScB[i] = cScen[v]; b.aMdB[i] = cMode[v];
        b.aProt[i] = cProt[u];
        if (k < IS) idx.push(i, i + 1);
      }
    });
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(p, 3)); g.setAttribute('aT', new THREE.BufferAttribute(t, 1));
    g.setAttribute('aLen', new THREE.BufferAttribute(len, 1));
    for (const [k, v] of Object.entries(b)) g.setAttribute(k, new THREE.BufferAttribute(v, 1));
    g.setIndex(idx);
    GL.IU = { uReveal: { value: 0 }, uAlpha: { value: 0 }, uIso: { value: -1 }, uSel: { value: -1 }, uFocus: { value: 0 }, uScen: { value: scen } };
    GL.ids = new THREE.LineSegments(g, idMaterial(GL.IU));
    GL.ids.renderOrder = 4;
    GL.world.add(GL.ids);
  }

  // ------------------------------------------------ travelling proteins and the proximity bubble
  {
    const n = 8, g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 3), 3));
    g.setAttribute('aCol', new THREE.BufferAttribute(new Float32Array(n * 3), 3));
    g.setAttribute('aA', new THREE.BufferAttribute(new Float32Array(n), 1));
    GL.actorMat = actorMaterial();
    GL.actors = new THREE.Points(g, GL.actorMat);
    GL.actors.frustumCulled = false;
    GL.actors.renderOrder = 9;
    GL.world.add(GL.actors);
  }
  GL.bubble = new THREE.Mesh(new THREE.SphereGeometry(1, 48, 32), bubbleMaterial());
  GL.bubble.renderOrder = 7; GL.bubble.visible = false;
  GL.world.add(GL.bubble);
  GL.highlights = {};
}
// a bright overlay along interactions (an example, a path, a protein's partners)
function setHighlight(key, pairs, color, opts = {}) {
  const old = GL.highlights[key];
  if (old) { GL.world.remove(old); old.geometry.dispose(); old.material.dispose(); delete GL.highlights[key]; }
  if (!pairs || !pairs.length) return null;
  const mesh = new THREE.Mesh(tubeGeometry(pairs, (opts.radius || 0.002) * (GL.hlScale || 1), opts.hops, opts.seed),
    highlightMaterial(color, !!opts.hops, opts.spread, opts.fade));
  mesh.renderOrder = 6;
  mesh.userData.args = [pairs, color, opts];
  GL.world.add(mesh);
  GL.highlights[key] = mesh;
  return mesh;
}
// lights up proteins along a path (step numbers) or a whole set at once
function setFocus(list, stepped) {
  const a = GL.attr.aFocus;
  a.fill(0);
  if (list) list.forEach((c, k) => { if (c >= 0) a[c] = stepped ? k + 1 : 1; });
  GL.dots.geometry.attributes.aFocus.needsUpdate = true;
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
// Narration timing: [time in your recording, original story cue]. The story's
// animation is stretched or squeezed between these points so each cue lands
// on the matching sentence. Until a narration is recorded, the table sets the
// pace: node tools/pace.mjs writes it from the words on the panel (each stretch
// between two cues lasts long enough to read what appeared at its start; run
// it again after the text changes). A recording replaces it with its own times.
const NARRATION_SYNC = [
  [0, 0], [2.6, 2.4], [5.3, 3.6],                     // Intro
  [16.1, 12], [17.1, 12.88], [18.3, 12.9], [18.6, 13.18], [19, 13.2], [19.4, 13.58], [25.8, 13.6],  // Compartments
  [50.4, 36], [51.7, 37.18], [52.9, 37.2], [59.7, 43], [68.6, 49],  // Addresses
  [76.3, 56], [77.6, 57.18], [78.9, 57.2], [87.5, 63], [90.8, 66], [102.8, 73],  // Meeting
  [110.5, 80], [111.8, 81.18], [112.6, 81.2], [123.5, 87], [130.6, 93],  // Many places
  [142.7, 104], [144, 105.18], [144.8, 105.2], [151.6, 109], [167, 123],  // Signals
  [180.8, 132], [182.1, 133.18], [183, 133.2], [195.9, 145], [204.2, 151],  // Moving
  [211.9, 158], [212.5, 158.6], [213.7, 159.2], [224.1, 165], [227.4, 168], [236.4, 173],  // Proximity
  [244.1, 180], [245.4, 181.18], [246.7, 181.2], [252.6, 184], [262, 192],  // Wrong place
  [277.4, 206], [280.9, 209.2], [287.4, 209.4], [288.9, 210.8], [309.9, 220],  // Recap
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
  { key: 'rooms', name: 'Compartments', a: 12, b: 36 },
  { key: 'address', name: 'Addresses', a: 36, b: 56 },
  { key: 'local', name: 'Meeting', a: 56, b: 80 },
  { key: 'multi', name: 'Many places', a: 80, b: 104 },
  { key: 'signal', name: 'Signals', a: 104, b: 132 },
  { key: 'move', name: 'Moving', a: 132, b: 158 },
  { key: 'prox', name: 'Proximity', a: 158, b: 180 },
  { key: 'disease', name: 'Wrong place', a: 180, b: 206 },
  { key: 'outro', name: 'Recap', a: 206, b: 220 },
];
CH.forEach(c => { c.na = narrT(c.a); c.nb = narrT(c.b); }); // chapter times on the recording's clock
const C = Object.fromEntries(CH.map(c => [c.key, c]));
const MV = Object.fromEntries(MOVES.map((m, k) => [m.key, k]));

const DEF = { org: 0, org_base: 0, cell_a: 1, node_reveal: 0, route_reveal: 0, route_alpha: 1, id_reveal: 0, id_alpha: 1, w_place: 1, w_multi: 0,
  focus: 0, path_prog: 0, path_alpha: 1, ex_prog: 0, ex_alpha: 1, cue_prog: 0, cue_alpha: 1, prox: 0, prox_r: 0,
  s0: 0, s1: 0, s2: 0, s3: 0, s4: 0, s5: 0, s6: 0 };
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

const ST = { labels: [], items: [], hopEnds: [], travel: [] };

// ------------------------------------------------------------- statistics --
// Is a copy there, given how far each move has gone?
function present(c, scen) {
  const k = NET.cScen[c];
  if (!k) return true;
  const s = scen[k - 1];
  return NET.cMode[c] === 2 ? s >= 0.5 : s < 0.5;
}
// which pairs of proteins can reach each other, over the copies that are there
function proteinReach(useCopy) {
  const { NC, P, cProt, adjS, adj } = NET;
  const comp = new Int32Array(NC).fill(-1);
  let nc = 0;
  for (let s = 0; s < NC; s++) {
    if (comp[s] >= 0 || !useCopy(s)) continue;
    const st = [s]; comp[s] = nc;
    while (st.length) { const u = st.pop(); for (let k = adjS[u]; k < adjS[u + 1]; k++) { const v = adj[k]; if (comp[v] < 0 && useCopy(v)) { comp[v] = nc; st.push(v); } } }
    nc++;
  }
  // proteins in the same component reach each other
  const sets = Array.from({ length: P }, () => new Set());
  for (let c = 0; c < NC; c++) if (comp[c] >= 0) sets[cProt[c]].add(comp[c]);
  return { sets, reach: (a, b) => { for (const x of sets[a]) if (sets[b].has(x)) return true; return false; } };
}
function placeStats() {
  const { E, eu, ev, cPlace, P, pPlaces } = NET;
  let same = 0;
  for (let e = 0; e < E; e++) if (cPlace[eu[e]] === cPlace[ev[e]]) same++;
  let share = 0, pairs = 0;
  for (let a = 0; a < P; a++) for (let b = a + 1; b < P; b++) { pairs++; if (pPlaces[a].some(x => pPlaces[b].includes(x))) share++; }
  return { same: same / E, rnd: share / pairs };
}

function buildStory() {
  const { P, NC, E, sym, cProt, pPlaces } = NET;
  const rest = new Array(8).fill(0);
  const ps = placeStats();
  const multi = [];
  for (let p = 0; p < P; p++) if (pPlaces[p].length > 1) multi.push(p);
  // if every protein had only its usual place, how many connected pairs would be cut?
  const full = proteinReach(c => present(c, rest));
  const one = proteinReach(c => present(c, rest) && NET.pCopies[cProt[c]][0] === c);
  let both = 0, lost = 0;
  for (let a = 0; a < P; a++) for (let b = a + 1; b < P; b++) if (full.reach(a, b)) { both++; if (!one.reach(a, b)) lost++; }
  const lostPct = Math.round(100 * lost / Math.max(1, both));
  ST.stats = { ps, multi, lostPct };
  // the growth signal, from EGF outside to SRF in the nucleus
  const path = ['EGF', 'EGFR@pm', 'GRB2', 'SOS1', 'KRAS', 'RAF1', 'MAP2K1', 'MAPK1@cyto', 'MAPK1@nuc', 'ELK1', 'SRF'].map(CP);
  ST.path = path;
  const L = path.length - 1;
  // NF-kB: partners before and after the move
  const partnersOf = (p, scenState) => {
    const out = new Set();
    for (const c of NET.pCopies[p]) {
      if (!present(c, scenState)) continue;
      for (let k = NET.adjS[c]; k < NET.adjS[c + 1]; k++) if (NET.adjT[k] === 0 && present(NET.adj[k], scenState)) out.add(cProt[NET.adj[k]]);
    }
    return out;
  };
  const delta = (p, mk) => {
    const on = rest.slice(); on[mk] = 1;
    const a = partnersOf(p, rest), b = partnersOf(p, on);
    return { lost: [...a].filter(x => !b.has(x)), gained: [...b].filter(x => !a.has(x)) };
  };
  ST.delta = delta;
  const nf = delta(A('RELA'), MV.nfkb), tdp = delta(A('TARDBP'), MV.als);
  const names = l => l.map(p => NET.name[p]).join(' and ').replace(/ and (?=.* and )/g, ', ');
  // proximity labelling around a lysosome protein
  const bait = CP('LAMTOR1'), BR = 0.09;
  const tagged = [];
  for (let c = 0; c < NC; c++) if (c !== bait && present(c, rest) && v3.len(v3.sub(cpos(c), cpos(bait))) < BR) tagged.push(c);
  const bp = NET.partners[cProt[bait]];
  const direct = tagged.filter(c => bp.has(cProt[c])).length;
  ST.prox = { bait, r: BR, tagged };

  // ------------------------------------------------------------ panel copy
  const pct = x => Math.round(x * 100);
  const legend = ORGS.map((n, k) => `<li data-at="${k ? 1.6 + 2 * (k - 1) : 0.9}"><span class="sw" style="background:${placeCss([1, 4, 5, 7, 8, 9, 10, 11, 12, 3][k])}"></span>${n}</li>`).join('');
  const html = {
    title: `<svg class="route-mark" viewBox="0 0 360 44" aria-hidden="true"><path id="titleArc" d="M8 36 Q180 -16 352 36" fill="none" stroke="var(--teal)" stroke-width="2.2" stroke-linecap="round" pathLength="1" stroke-dasharray="1" stroke-dashoffset="1"/><circle cx="8" cy="36" r="4.5" fill="var(--teal)"/><circle cx="352" cy="36" r="4.5" fill="var(--teal)" id="titleDot" opacity="0"/></svg>
      <h1 data-at="1.2">Spatial interactome</h1>
      <p class="lede" data-at="2.4">where proteins meet inside a human cell</p>
      <p data-at="3.6">${fmt(P)} proteins in the compartments of a model cell, and the ${fmt(E)} interactions between them. Eight ideas about how location shapes the protein network, then the cell is yours to explore.</p>`,
    rooms: `<h2 data-at="0.6">A cell has rooms</h2>
      <p data-at="1.2">Membranes divide a human cell into compartments, each with its own chemistry and its own set of proteins.</p>
      <ul class="legend">${legend}</ul>
      <p class="note" data-at="21">The cytoplasm fills the space between them.</p>`,
    address: `<h2 data-at="0.6">Every protein has an address</h2>
      <p data-at="1.2">Each dot is a protein, coloured by the compartment it works in. This model holds ${fmt(P)} well-studied human proteins.</p>
      <p data-at="7">The address is written into the protein itself: short signals in its sequence send it into the nucleus, into the ER or into mitochondria.</p>
      <p class="note" data-at="13">The Human Protein Atlas has located more than 12,000 human proteins by staining them in cells.</p>`,
    local: `<h2 data-at="0.6">Proteins bind where they meet</h2>
      <p data-at="1.2">Two proteins can only bind if they are in the same place at the same time. These are the ${fmt(E)} interactions in this cell.</p>
      <div class="big cyan" data-at="7">${pct(ps.same)}%<small>in one compartment</small></div>
      <p data-at="10">The rest reach across a boundary: EGF outside the cell binds its receptor in the membrane, and the receptor binds GRB2 just inside. Of random pairs of proteins, only ${pct(ps.rnd)}% share a compartment.</p>
      <p class="note" data-at="17">Spatial maps help weed out interactions measured in a test tube between proteins that never meet in a living cell.</p>`,
    multi: `<h2 data-at="0.6">One protein, several places</h2>
      <p data-at="1.2">About half of human proteins are found in more than one place. Dotted lines join the copies of the ${multi.length} proteins here that live or work in two or three.</p>
      <p data-at="7">Beta-catenin glues cells together at the membrane, is destroyed in the cytoplasm and switches on genes in the nucleus.</p>
      <div class="big amber" data-at="13">${lostPct}%<small>of linked protein pairs</small></div>
      <p data-at="14.5">would lose touch if every protein stayed in its usual place. Proteins with several addresses tie the compartments together.</p>`,
    signal: `<h2 data-at="0.6">Signals cross the cell</h2>
      <p data-at="1.2">A growth signal outside the cell reaches the genes in the nucleus by passing from protein to protein.</p>
      <div class="big teal" data-at="5"><span id="steps">0</span><small id="stepsWord">steps</small></div>
      <p data-at="19">The EGF receptor carries the signal across the membrane, the RAS relay passes it through the cytoplasm, and ERK itself travels through a nuclear pore to switch on ELK1 and SRF: ${L} steps, one of them a move.</p>`,
    move: `<h2 data-at="0.6">Moving rewires the network</h2>
      <p data-at="1.2">In a resting cell the inflammation switch NF-κB waits in the cytoplasm, held by its inhibitor IκBα.</p>
      <p data-at="7">TNF outside the cell sets off a relay that marks IκBα for destruction.</p>
      <p data-at="13">Freed, NF-κB moves into the nucleus. It leaves ${nf.lost.length === 1 ? NET.name[nf.lost[0]] : nf.lost.length + ' partners'} behind and gains ${nf.gained.length === 1 ? 'a new partner' : nf.gained.length + ' new partners'}, ${names(nf.gained)}, which switch on inflammation genes.</p>
      <p data-at="19" class="amber">Same protein, new place, new partners, new job.</p>`,
    prox: `<h2 data-at="0.6">Mapping by proximity</h2>
      <p data-at="1.2">How are such maps made? Microscopes show where proteins sit. Proximity labelling fuses an enzyme to a bait protein, and it tags every protein within about ten nanometres.</p>
      <div class="big green" data-at="7">${tagged.length}<small>proteins tagged around ${sym[cProt[bait]]}</small></div>
      <p data-at="10">${direct === tagged.length ? `All of them bind ${sym[cProt[bait]]} directly.` : `${direct} of them bind ${sym[cProt[bait]]} directly; the others are neighbours on the same lysosome.`} Hundreds of baits together chart the neighbourhoods of a whole cell.</p>
      <p class="note" data-at="15">In this model the bubble is drawn far larger than ten nanometres.</p>`,
    disease: `<h2 data-at="0.6">Proteins in the wrong place</h2>
      <p data-at="1.2">Many disease mutations leave a protein able to work, but send it to the wrong place.</p>
      <p data-at="4">Cystic fibrosis: the F508del mutation makes the chloride channel CFTR fold badly. Quality control in the ER catches it, and it never reaches the membrane.</p>
      <p data-at="12">ALS: in nearly all patients, TDP-43 leaves the nucleus of motor neurons and clumps in the cytoplasm. It loses ${tdp.lost.length} splicing partners and gains ${tdp.gained.length} new ones there.</p>`,
    outro: `<h2 data-at="0.6">Spatial interactome</h2>
      <ul class="concepts" data-at="1.4">${CH.slice(1, 9).map(c => `<li>${c.name}</li>`).join('')}</ul>
      <p data-at="2.6">Now it's your turn. Search any protein, trace signals between compartments, set proteins moving, or tag a protein's neighbours.</p>
      <p data-at="3.4"><button class="btn primary" id="btnGoExplore" type="button">Explore the cell</button></p>
      <p class="credits" data-at="4.2">An illustrative, curated set of ${fmt(P)} well-studied human proteins and ${fmt(E)} documented interactions, placed in a model cell; a real cell makes about 20,000 kinds of protein. Places follow the Human Protein Atlas and UniProt. Ideas: Thul et al. 2017 (subcellular map of the human proteome); Go et al. 2021 (Human Cell Map); Cho et al. 2022 (OpenCell); Qin et al. 2021 (MuSIC); Lundberg &amp; Borner 2019.</p>`,
  };
  const story = $('#story');
  story.innerHTML = CH.map(c => `<section class="ch" data-ch="${c.key}">${html[c.key]}</section>`).join('');
  CH.forEach(c => {
    const sec = story.querySelector(`[data-ch="${c.key}"]`);
    ST.items.push({ sec, ch: c, els: Array.from(sec.querySelectorAll('[data-at]')).map(el => ({
      el, at: c.a + parseFloat(el.dataset.at), out: el.dataset.out ? c.a + parseFloat(el.dataset.out) : c.b - 0.05, o: -1 })),
      grow: Array.from(sec.querySelectorAll('[data-grow]')).map(el => ({ el, at: c.a + parseFloat(el.dataset.grow), s: -1 })) });
  });

  buildCamera(path, bait);
  // ------------------------------------------------------------ timeline keys
  let a, b;
  ramp('org', 0.5, 3, 0, 1); ramp('org_base', 1.5, 6, 0, 0.3);
  a = C.rooms.a; b = C.rooms.b;
  const used = [];
  for (let k = 1; k < ORGS.length; k++) {
    const t = a + 1.7 + 2 * (k - 1);
    ramp('org', a + 1.5 + 2 * (k - 1), a + 2.8 + 2 * (k - 1), k, k + 1);
    const p = orgAnchor(k, t, used);
    used.push(p);
    labelAt(p, `<b>${ORGS[k]}</b>`, t, b - 0.6, 'cyn');
  }
  ramp('cell_a', b - 1, b + 2, 1, 0.75);
  a = C.address.a; b = C.address.b;
  ramp('node_reveal', a + 2, a + 9, 0, 1);
  [['EGFR@pm', 'on the cell surface'], ['HSPA5', 'inside the ER'], ['TOMM40', 'gate into mitochondria'], ['NPM1', 'in the nucleolus'], ['CAT', 'in a peroxisome'], ['GOLGA2', 'on the Golgi']]
    .forEach(([s, t], k) => label(CP(s), `<b>${sym[cProt[CP(s)]]}</b>${t}`, a + 7.5 + 0.8 * k, b - 0.6, ''));
  a = C.local.a; b = C.local.b;
  ramp('route_reveal', a + 3, a + 12, 0, 1);
  ramp('ex_prog', a + 10.5, a + 13, 0, 1); ramp('ex_alpha', b - 2, b, 1, 0);
  label(CP('EGF'), '<b>EGF</b>outside', a + 10.5, b - 0.6, 'tl');
  label(CP('EGFR@pm'), '<b>EGFR</b>in the membrane', a + 11.2, b - 0.6, 'tl');
  label(CP('GRB2'), '<b>GRB2</b>just inside', a + 11.9, b - 0.6, 'tl');
  a = C.multi.a; b = C.multi.b;
  ramp('id_reveal', a + 2, a + 6, 0, 1);
  ramp('focus', a + 7, a + 8.5, 0, 1); ramp('focus', a + 12.5, a + 14, 1, 0);
  NET.pCopies[A('CTNNB1')].forEach((c, k) => label(c, `<b>CTNNB1</b>${['at the membrane', 'in the cytoplasm', 'in the nucleus'][k]}`, a + 7.4 + 0.6 * k, a + 13, 'amb'));
  ramp('w_multi', a + 13, a + 15, 0, 1); ramp('w_multi', b - 1.5, b + 0.5, 1, 0);
  a = C.signal.a; b = C.signal.b;
  ramp('focus', a + 1, a + 3, 0, 1); ramp('focus', b - 2, b, 1, 0); ramp('path_alpha', b - 2, b, 1, 0);
  {
    const dur = 11.5 / L, pause = 0.25;
    let t = a + 5.5;
    key('path_prog', t, 0);
    label(path[0], `<b>EGF</b>growth signal`, a + 5, b - 1.2, 'tl');
    for (let k = 0; k < L; k++) {
      key('path_prog', t + dur - pause, k + 1);
      ST.hopEnds.push(t + dur - pause);
      const c = path[k + 1], moveStep = cProt[c] === cProt[path[k]];
      const tag = { 1: 'receptor', 4: 'RAS switch', 7: 'ERK', 8: 'ERK in the nucleus', 10: 'gene switch' }[k + 1];
      if (tag) label(c, `<b>${sym[cProt[c]]}</b>${tag}`, t + dur - pause - 0.2, b - 1.2, 'tl');
      if (moveStep) ST.travel.push({ from: path[k], to: c, t0: t, t1: t + dur - pause, a: b - 1.5, col: SIG_DOT });
      t += dur;
    }
  }
  a = C.move.a; b = C.move.b;
  const nfk = MOVES[MV.nfkb];
  ramp('cue_prog', a + 7, a + 11, 0, 1); ramp('cue_alpha', a + 15, a + 17, 1, 0);
  ramp('s' + MV.nfkb, a + 13, a + 17, 0, 1); ramp('s' + MV.nfkb, b - 1.5, b, 1, 0);
  nfk.travelers.forEach(([f, to], k) => ST.travel.push({ from: f, to, t0: a + 13 + 0.3 * k, t1: a + 17 + 0.3 * k, a: b - 2, col: [1.0, 0.82, 0.3] }));
  label(CP('RELA@cyto'), '<b>RELA</b>NF-κB, waiting', a + 1.6, a + 13.5, 'amb');
  label(CP('NFKBIA'), '<b>IκBα</b>its inhibitor', a + 2.2, a + 15, 'amb');
  label(CP('TNF'), '<b>TNF</b>inflammation signal', a + 7, a + 12, 'tl');
  label(CP('RELA@nuc'), '<b>RELA</b>in the nucleus', a + 17, b - 1.5, 'amb');
  nf.gained.forEach((p, k) => label(NET.pCopies[p][0], `<b>${sym[p]}</b>new partner`, a + 17.6 + 0.5 * k, b - 1.5, 'grn'));
  a = C.prox.a; b = C.prox.b;
  ramp('prox', a + 4, a + 6, 0, 1); ramp('prox', b - 2, b, 1, 0);
  ramp('prox_r', a + 4, a + 8, 0, 1);
  label(bait, `<b>${sym[cProt[bait]]}</b>bait`, a + 4, b - 1, 'grn');
  a = C.disease.a; b = C.disease.b;
  ramp('s' + MV.cf, a + 5, a + 8, 0, 1); ramp('s' + MV.cf, b - 1, b + 1, 1, 0);
  MOVES[MV.cf].fails.forEach(([f, to]) => ST.travel.push({ from: f, to, t0: a + 5, t1: a + 9, a: a + 9, fail: true, col: [1.0, 0.82, 0.3] }));
  label(CP('CFTR@er'), '<b>CFTR</b>caught in the ER', a + 5, b - 1, 'amb');
  label(CP('CFTR@pm'), '<b>CFTR</b>never arrives', a + 6, a + 11, 'amb');
  ramp('s' + MV.als, a + 13, a + 17, 0, 1); ramp('s' + MV.als, b - 1, b + 1, 1, 0);
  MOVES[MV.als].travelers.forEach(([f, to]) => ST.travel.push({ from: f, to, t0: a + 13, t1: a + 17, a: b - 1.5, col: [1.0, 0.82, 0.3] }));
  label(CP('TARDBP@nuc'), '<b>TDP-43</b>leaves the nucleus', a + 12.5, a + 16, 'amb');
  label(CP('TARDBP@cyto'), '<b>TDP-43</b>clumps in the cytoplasm', a + 16.5, b - 1, 'amb');
  for (const n in TR) TR[n].sort((x, y) => x[0] - y[0]);

  // which proteins glow when the story focuses on a set
  ST.focusSets = { multi: NET.pCopies[A('CTNNB1')], signal: path };

  // ------------------------------------------------------------ highlights
  setHighlight('ex', [[CP('EGF'), CP('EGFR@pm')], [CP('EGFR@pm'), CP('GRB2')]], SIG, { radius: 0.0045, fade: SIG_A });
  const cue = nfk.cueCopies;
  setHighlight('cue', cue.slice(0, -1).map((c, k) => [c, cue[k + 1]]), SIG, { radius: 0.004, fade: SIG_A, hops: cue.slice(0, -1).map((_, k) => k + 1) });
  setHighlight('path', path.slice(0, -1).map((c, k) => [c, path[k + 1]]), SIG, { radius: 0.0055, fade: SIG_A, hops: path.slice(0, -1).map((_, k) => k + 1) });
  ST.cueLen = cue.length - 1;

}
// ------------------------------------------------------------ camera: orbit the cell, lean in on the action
function buildCamera(path, bait) {
  const dirOf = list => latLonOf(v3.norm(list.reduce((s, c) => v3.add(s, v3.norm(cpos(c))), [0, 0, 0])));
  const at = (t, list, d, tilt, ease) => { const [la, lo] = dirOf(list); return [t, clamp(la, -60, 60), lo, d, tilt || 0, 0, ease ? 'east' : undefined, ease]; };
  const spinAround = (w, dLon, ease) => [w[0], w[1], w[2] + dLon, w[3], w[4], w[5], ease && 'east', ease];
  const nfAll = [...NET.pCopies[A('RELA')], CP('NFKBIA'), CP('TNF')];
  const cf = NET.pCopies[A('CFTR')], tdpC = NET.pCopies[A('TARDBP')];
  const wp = [[0, 16, 30, 3.5, 0, 0], [C.rooms.a, 14, 70, 3.2, 0, 0, 'east', 'spin'],
    [C.rooms.b - 2, 12, 250, 3.0, 0, 0, 'east', 'spin'],
    [C.address.a + 2, 18, 260, 3.0, 0, 0], [C.address.b, 12, 360, 3.0, 0, 0, 'east', 'spin'],
    at(C.local.a + 8, [CP('EGF'), CP('EGFR@pm'), CP('GRB2')], 1.9), spinAround(at(C.local.b - 1, [CP('EGF'), CP('EGFR@pm'), CP('GRB2')], 2.1), 18, 'spin'),
    spinAround(at(C.multi.a + 4, NET.pCopies[A('CTNNB1')], 2.6), -25), spinAround(at(C.multi.b - 1, NET.pCopies[A('CTNNB1')], 2.9), 25, 'spin'),
    at(C.signal.a + 4, path, 2.5), spinAround(at(C.signal.b - 2, path, 2.6), 30, 'spin'),
    at(C.move.a + 4, nfAll, 2.3), spinAround(at(C.move.b - 1, nfAll, 2.3), 25, 'spin'),
    at(C.prox.a + 4, [bait], 1.25), spinAround(at(C.prox.b - 1, [bait], 1.35), 30, 'spin'),
    at(C.disease.a + 4, cf, 2.4), at(C.disease.a + 11, cf, 2.4, 0),
    at(C.disease.a + 14, tdpC, 2.2), spinAround(at(C.disease.b - 1, tdpC, 2.3), 30, 'spin'),
    [C.outro.b, 18, 200, 3.4, 0, 0]];
  wp.sort((x, y) => x[0] - y[0]);
  let prev = null;
  ST.wp = wp.map(w => {
    let lon = w[2];
    if (prev !== null) lon = w[6] === 'east' ? prev + (((w[2] - prev) % 360) + 360) % 360 : w[2] + 360 * Math.round((prev - w[2]) / 360);
    prev = lon;
    return [w[0], w[1], lon, w[3], w[4], w[5], w[7]];
  });
}
// where to pin an organelle's label at time t: an instance on the side facing the camera,
// away from the labels already placed
function orgAnchor(k, t, used) {
  const cam = storyCam(t), pose = cameraPose(cam[0], cam[1], cam[2] + 1, cam[3], cam[4]);
  const cd = v3.norm([pose.C.x, pose.C.y, pose.C.z]);
  const score = p => v3.dot(v3.norm(p), cd) * 0.6 + Math.min(...used.map(u => v3.len(v3.sub(u, p))), 0.6);
  const pick = list => list.reduce((b, p) => (score(p) > score(b) ? p : b));
  const { nuc, nucl } = CELL;
  if (k === 1) return v3.add(nuc.c, v3.mul(v3.norm(v3.add(cd, [0, 0.9, 0])), nuc.r));
  if (k === 2) return nucl.c;
  if (k === 3) {
    const cands = [];
    for (let i = 0; i < 300; i++) {
      const d = v3.norm([Math.cos(i * 2.39), Math.sin(i * 0.7) * 0.8, Math.sin(i * 2.39)]);
      if (CELL.erMask(d, 2) > 0.4 && v3.dot(d, cd) > 0.3) cands.push(v3.add(nuc.c, v3.mul(d, CELL.er.r[2])));
    }
    return cands.length ? pick(cands) : GL.orgAnchor[3];
  }
  if (k === 4) return GL.orgAnchor[4];
  if (k === 5) return pick(CELL.mitos.map(o => o.c));
  if (k === 6) return pick(CELL.lysos.map(o => o.c));
  if (k === 7) return pick(CELL.endos.map(o => o.c));
  if (k === 8) return pick(CELL.peroxs.map(o => o.c));
  return pick(CELL.mts.map(m => m[Math.min(m.length - 1, 7)]));
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
  if (t <= wp[0][0]) return wp[0].slice(1, 6);
  for (let i = 1; i < wp.length; i++) {
    if (t <= wp[i][0]) {
      const a = wp[i - 1], b = wp[i], x = (b[6] === 'spin' ? spinEase : smoothSeg)(t - a[0], b[0] - a[0]);
      return [a[1] + (b[1] - a[1]) * x, a[2] + (b[2] - a[2]) * x, Math.exp(Math.log(a[3]) + (Math.log(b[3]) - Math.log(a[3])) * x),
        a[4] + (b[4] - a[4]) * x, a[5] + (b[5] - a[5]) * x];
    }
  }
  return wp[wp.length - 1].slice(1, 6);
}

// ------------------------------------------------- travelling proteins --
// a bright dot that follows a protein from one place to another (or tries to)
const TRV = { curves: new Map() };
function travelPoint(from, to, x, out) {
  const k = from + '>' + to;
  let cv = TRV.curves.get(k);
  if (!cv) { cv = travelCurve(from, to, 60); TRV.curves.set(k, cv); }
  const u = clamp(x, 0, 1) * 60, i = Math.min(59, Math.floor(u)), f = u - i;
  for (let j = 0; j < 3; j++) out[j] = cv[3 * i + j] * (1 - f) + cv[3 * i + 3 + j] * f;
  return out;
}
const _tp = [0, 0, 0];
// list: [{from, to, x (0..1 along the way), a (alpha), col, fail}]
function setActors(list) {
  const g = GL.actors.geometry, p = g.attributes.position, c = g.attributes.aCol, al = g.attributes.aA;
  for (let k = 0; k < 8; k++) {
    const it = list[k];
    if (!it || it.a <= 0.001) { al.array[k] = 0; continue; }
    const x = it.fail ? Math.min(it.x, 0.35) : it.x;
    travelPoint(it.from, it.to, x, _tp);
    p.array.set(_tp, 3 * k);
    const red = it.fail ? smooth((it.x - 0.3) / 0.25) : 0;
    c.array.set([it.col[0], it.col[1] * (1 - red) + 0.25 * red, it.col[2] * (1 - red) + 0.18 * red], 3 * k);
    al.array[k] = it.a * (it.fail ? 1 - smooth((it.x - 0.55) / 0.35) : 1);
  }
  p.needsUpdate = true; c.needsUpdate = true; al.needsUpdate = true;
}
function storyActors(t) {
  const list = [];
  for (const tr of ST.travel) {
    if (t < tr.t0 - 0.2 || t > tr.a + 0.5) continue;
    const x = smooth((t - tr.t0) / (tr.t1 - tr.t0));
    const a = Math.min(smooth((t - tr.t0 + 0.2) / 0.4), 1 - smooth((t - tr.t1) / 0.6));
    list.push({ from: tr.from, to: tr.to, x, a, col: tr.col, fail: tr.fail });
  }
  setActors(list);
}

// ---------------------------------------------------------------- labels --
const LBL = { story: ST.labels, extra: [] };
function label(i, html, tIn, tOut, cls) {
  const el = document.createElement('div');
  el.className = 'lbl ' + (cls || '');
  el.innerHTML = html;
  el.style.opacity = 0;
  $('#labels').appendChild(el);
  ST.labels.push({ el, i, tIn, tOut, o: -1 });
}
// a label at a point in the cell rather than on a protein
function labelAt(p, html, tIn, tOut, cls) {
  label(-1, html, tIn, tOut, cls);
  ST.labels[ST.labels.length - 1].p = p;
}
const _v = new THREE.Vector3();
function labelPos(L, out) {
  if (L.p) return out.set(L.p[0], L.p[1], L.p[2]);
  return nodePos(L.i, 0, out);
}
// labels on screen: pinned next to their protein, nudged down where they would overlap
const _placed = [];
function placeLabels(list, alphaOf) {
  _placed.length = 0;
  const vis = [];
  for (const L of list) {
    const o = Math.round(alphaOf(L) * 100) / 100;
    if (o !== L.o) { L.el.style.opacity = o; L.o = o; }
    if (o <= 0) continue;
    labelPos(L, _v).project(GL.camera);
    if (!L.w) { L.w = L.el.offsetWidth || 120; L.h = L.el.offsetHeight || 22; }
    vis.push([L, (_v.x * 0.5 + 0.5) * window.innerWidth + 9, (-_v.y * 0.5 + 0.5) * window.innerHeight - 11]);
  }
  vis.sort((p, q) => p[2] - q[2]);
  for (const [L, x, y0] of vis) {
    let y = y0;
    for (let pass = 0; pass < 6; pass++) {
      const hit = _placed.find(r => x < r[0] + r[2] && r[0] < x + L.w && y < r[1] + r[3] && r[1] < y + L.h);
      if (!hit) break;
      y = hit[1] + hit[3] + 2;
    }
    _placed.push([x, y, L.w, L.h]);
    L.el.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px)`;
  }
}

// ------------------------------------------------------------ panel update --
let curCh = null;
function updateStoryDOM(t) {
  const c = CH.find(c => t >= c.a && t < c.b) || CH[CH.length - 1];
  if (c !== curCh) {
    const fs = ST.focusSets && ST.focusSets[c.key];
    setFocus(fs || null, c.key === 'signal');
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
  if (c.key === 'signal') {
    const n = ST.hopEnds.filter(x => t >= x).length;
    $('#steps').textContent = n;
    $('#stepsWord').textContent = n === 1 ? 'step' : 'steps';
  }
}

// ------------------------------------------------------------- timeline UI --
function buildTimeline() {
  const tr = $('#track');
  tr.innerHTML = '<div class="rail"></div><div class="done"></div>' + CH.slice(1).map(c =>
    `<div class="tick" data-k="${c.key}" style="left:${(100 * c.na / T_END).toFixed(2)}%"></div><div class="name" data-k="${c.key}" style="left:${(100 * c.na / T_END).toFixed(2)}%">${c.name}</div>`).join('') + '<div class="knob"></div>';
  tr.setAttribute('aria-valuemax', Math.round(T_END));
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
  // slideshow: Next and this story's switch, in the shell's row at the foot of the panel (an older shell has none)
  if ($('#slides')) { $('#btnNext').addEventListener('click', slideNext); $('#btnSlides').addEventListener('click', slideToggle); }
  if ($('#btnNextBar')) $('#btnNextBar').addEventListener('click', slideNext);   // Next beside Play (phones)
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
  slideDOM();
}

// ================================================================ EXPLORE ==
const X = { color: 'place', cell: 'on', routes: 0.7, sel: -1, selCopy: -1, path: null, count: 0, iso: -1, tab: 'protein',
  scen: new Array(MOVES.length).fill(0), moveT: new Array(MOVES.length).fill(-1), bait: -1, proxR: 0.09 };
const XS = Object.assign({}, DEF, { org: ORGS.length, node_reveal: 1, route_reveal: 1, id_reveal: 1, sel_prog: 0, w_deg: 0, cue_prog: 0, cue_alpha: 0 });
const orbit = { cur: [18, 40, 3.4, 0, 0], from: null, to: null, t0: 0, dur: 1.4 };
const CUE_S = 1.6, MOVE_S = 3.2;
const scenNow = () => MOVES.map((_, k) => XS['s' + k]);
const isThere = c => present(c, scenNow());

function exploreStep(dt, now) {
  const k = 1 - Math.exp(-dt * 5);
  const pathOn = X.path && X.tab === 'path';
  const tg = { w_place: X.color === 'place' ? 1 : 0, w_multi: X.color === 'multi' ? 1 : 0, w_deg: X.color === 'deg' ? 1 : 0,
    cell_a: X.cell === 'on' ? 1 : X.cell === 'faint' ? 0.35 : 0,
    route_alpha: X.routes * (pathOn ? 0.3 : 1), focus: pathOn ? 1 : 0,
    prox: X.tab === 'prox' && X.bait >= 0 ? 1 : 0, prox_r: X.proxR };
  for (const n in tg) XS[n] += (tg[n] - XS[n]) * k;
  if (X.path) XS.path_prog = Math.min(X.path.length - 1, XS.path_prog + dt * 1.6);
  XS.sel_prog = Math.min(1, XS.sel_prog + dt * 0.7);
  // moves: an optional cue (the signal), then the proteins travel
  let cue = -1;
  MOVES.forEach((m, j) => {
    const n = 's' + j, want = X.scen[j];
    if (want && X.moveT[j] >= 0) {
      const el = (now - X.moveT[j]) / 1000, hasCue = m.cueCopies.length > 1, start = hasCue ? CUE_S : 0;
      if (hasCue && el < CUE_S + 1.2) cue = j;
      if (el > start) XS[n] = Math.min(1, XS[n] + dt / MOVE_S);
    } else if (!want) XS[n] = Math.max(0, XS[n] - dt / (MOVE_S * 0.7));
  });
  if (cue !== X.cueOn) {
    X.cueOn = cue;
    const cc = cue >= 0 ? MOVES[cue].cueCopies : null;
    setHighlight('xcue', cc ? cc.slice(0, -1).map((c, i) => [c, cc[i + 1]]) : null, SIG, { radius: 0.004, fade: SIG_A, hops: cc ? cc.slice(0, -1).map((_, i) => i + 1) : null });
  }
  if (cue >= 0) {
    const el = (now - X.moveT[cue]) / 1000;
    XS.cue_prog = (MOVES[cue].cueCopies.length - 1) * clamp(el / CUE_S, 0, 1);
    XS.cue_alpha = 1 - smooth((el - CUE_S - 0.4) / 0.8);
  }
  // travelling dots while a move is under way
  const list = [];
  MOVES.forEach((m, j) => {
    const s = XS['s' + j];
    if (s <= 0.002 || s >= 0.998) return;
    const a = Math.min(smooth(s / 0.08), smooth((1 - s) / 0.08));
    m.travelers.forEach(([f, t]) => list.push({ from: f, to: t, x: s, a, col: [1.0, 0.82, 0.3] }));
    m.fails.forEach(([f, t]) => list.push({ from: f, to: t, x: s, a: 1, col: [1.0, 0.82, 0.3], fail: true }));
  });
  setActors(list);
  return XS;
}
function setMove(j, on) {
  if (!!X.scen[j] === !!on) return;
  X.scen[j] = on ? 1 : 0;
  X.moveT[j] = on ? performance.now() : -1;
  renderMoves();
  // paths and the selected protein may change once the proteins have moved
  clearTimeout(setMove.t);
  setMove.t = setTimeout(() => { if (X.sel >= 0) renderProtein(X.sel); if (X.pathEnds) runPath(X.pathEnds[0], X.pathEnds[1], false); renderProx(); }, (CUE_S + MOVE_S) * 1000 + 200);
}
function applyUniforms(S, explore) {
  const U = GL.U, RU = GL.RU, IU = GL.IU;
  U.uReveal.value = S.node_reveal; U.uWPlace.value = S.w_place; U.uWMulti.value = S.w_multi; U.uWDeg.value = S.w_deg || 0;
  U.uFocus.value = S.focus; U.uPathProg.value = S.path_prog;
  for (let k = 0; k < MOVES.length; k++) U.uScen.value[k] = S['s' + k];
  U.uIso.value = explore ? X.iso : -1; U.uSel.value = explore ? X.sel : -1;
  const bait = explore ? X.bait : ST.prox.bait;
  if (bait >= 0) U.uProx.value.set(POS[3 * bait], POS[3 * bait + 1], POS[3 * bait + 2], Math.max(1e-4, S.prox_r * (explore ? 1 : ST.prox.r)));
  U.uProxOn.value = S.prox;
  RU.uReveal.value = S.route_reveal; RU.uAlpha.value = 0.55 * S.route_alpha; RU.uWPlace.value = S.w_place;
  RU.uIso.value = U.uIso.value; RU.uFocus.value = S.focus; RU.uProxOn.value = S.prox;
  IU.uReveal.value = S.id_reveal; IU.uAlpha.value = 0.75 * S.id_alpha; IU.uIso.value = U.uIso.value; IU.uSel.value = U.uSel.value; IU.uFocus.value = S.focus * 0.6;
  // organelles: revealed one by one in the story, dimmed when one place is isolated
  const isoOrg = X.iso >= 0 && explore ? ORG_OF_PLACE[NET.PK[X.iso]] : -2;
  GL.orgMats.forEach((mats, k) => {
    let a = Math.max(clamp(S.org - k, 0, 1), S.org_base || 0) * S.cell_a;
    if (isoOrg > -2) a *= k === isoOrg || k === 0 ? 1 : 0.25;
    for (const m of mats) {
      if (m.uniforms) m.uniforms.uA.value = a;
      else { m.opacity = m.userData.base * a; m.visible = a > 0.01; }
    }
  });
  const pr = GL.bubble;
  pr.visible = S.prox > 0.01 && bait >= 0;
  if (pr.visible) { pr.position.set(POS[3 * bait], POS[3 * bait + 1], POS[3 * bait + 2]); pr.scale.setScalar(Math.max(1e-4, S.prox_r * (explore ? 1 : ST.prox.r))); pr.material.uniforms.uA.value = 0.6 * S.prox; }
  const H = GL.highlights;
  const set = (k, p, a) => { const m = H[k]; if (!m) return; m.material.uniforms.uProg.value = p; m.material.uniforms.uAlpha.value = a; m.visible = a > 0.003 && p > 0.001; };
  set('ex', S.ex_prog, explore ? 0 : S.ex_alpha);
  set('cue', S.cue_prog * ST.cueLen, explore ? 0 : S.cue_alpha);
  set('path', S.path_prog, explore ? 0 : S.path_alpha);
  set('xcue', XS.cue_prog, explore ? XS.cue_alpha : 0);
  set('sel', XS.sel_prog, explore ? 0.9 : 0);
  set('xpath', XS.path_prog, explore ? 1 : 0);
}
const LV = new THREE.Vector3();
function updateLight(xr) {
  GL.rig.updateMatrixWorld(true);
  const setL = v => { for (const mats of GL.orgMats) for (const m of mats) if (m.uniforms) m.uniforms.uL.value.copy(v); };
  if (xr) {
    LV.set(-0.55, 0.42, 1.0).normalize().applyQuaternion(GL.rig.quaternion);
    setL(LV);
    GL.U.uScale.value = 1; GL.actorMat.uniforms.uScale.value = 1;
    GL.U.uPx.value = XR.pointK * XR.R * XR.viewH * 0.5; GL.actorMat.uniforms.uPx.value = GL.U.uPx.value;
    return;
  }
  GL.U.uPx.value = 0; GL.actorMat.uniforms.uPx.value = 0;
  LV.set(-0.55, 0.42, 1.0).normalize().applyQuaternion(GL.camera.quaternion);
  setL(LV);
  GL.U.uScale.value = GL.renderer.getPixelRatio() * clamp(3.6 / GL.camera.position.length(), 0.75, 2.4);
  GL.actorMat.uniforms.uScale.value = GL.U.uScale.value;
}

// ------------------------------------------------------------- graph maths --
// shortest path between two proteins over the copies that are there; a step is
// a binding or a move between places. Among equally short paths, take the one
// that travels the shortest distance through the cell.
function bestPath(s, t) {
  const { NC, adjS, adj, cProt, pDeg, pCopies } = NET;
  const dist = new Int16Array(NC).fill(-1), order = [], score = new Float64Array(NC).fill(-Infinity), prev = new Int32Array(NC).fill(-1), sigma = new Float64Array(NC);
  for (const c of pCopies[s]) if (isThere(c)) { dist[c] = 0; order.push(c); score[c] = 0; sigma[c] = 1; }
  let h = 0, found = -1;
  while (h < order.length) {
    const u = order[h++];
    if (found >= 0 && dist[u] >= dist[found]) break;
    for (let k = adjS[u]; k < adjS[u + 1]; k++) {
      const v = adj[k];
      if (!isThere(v)) continue;
      if (dist[v] < 0) { dist[v] = dist[u] + 1; order.push(v); if (cProt[v] === t && found < 0) found = v; }
      if (dist[v] === dist[u] + 1) {
        sigma[v] += sigma[u];
        const sc = score[u] - Math.hypot(POS[3 * v] - POS[3 * u], POS[3 * v + 1] - POS[3 * u + 1], POS[3 * v + 2] - POS[3 * u + 2]);
        if (sc > score[v]) { score[v] = sc; prev[v] = u; }
      }
    }
  }
  if (found < 0) return null;
  // the best-scoring copy of the target at that distance
  let end = found;
  for (const c of pCopies[t]) if (dist[c] === dist[found] && score[c] > score[end]) end = c;
  const path = [end];
  while (dist[path[path.length - 1]] > 0) path.push(prev[path[path.length - 1]]);
  let count = 0;
  for (const c of pCopies[t]) if (dist[c] === dist[found]) count += sigma[c];
  return { path: path.reverse(), count };
}
function reachInfo(p) {
  const { NC, adjS, adj, cProt, pCopies } = NET;
  const dist = new Int16Array(NC).fill(-1), q = [];
  for (const c of pCopies[p]) if (isThere(c)) { dist[c] = 0; q.push(c); }
  const best = new Map();
  for (let h = 0; h < q.length; h++) {
    const u = q[h];
    for (let k = adjS[u]; k < adjS[u + 1]; k++) { const v = adj[k]; if (dist[v] < 0 && isThere(v)) { dist[v] = dist[u] + 1; q.push(v); } }
  }
  for (const c of q) { const pp = cProt[c]; if (pp !== p && (!best.has(pp) || dist[c] < best.get(pp))) best.set(pp, dist[c]); }
  let sum = 0, far = -1, fd = -1;
  best.forEach((d, pp) => { sum += d; if (d > fd || (d === fd && NET.pDeg[pp] > NET.pDeg[far])) { fd = d; far = pp; } });
  return { n: best.size, avg: best.size ? sum / best.size : 0, far, fd };
}
// a protein's partners, grouped by the place where they meet
function partnersByPlace(p) {
  const { pCopies, adjS, adj, adjT, cProt, cPlace } = NET, out = new Map();
  for (const c of pCopies[p]) {
    for (let k = adjS[c]; k < adjS[c + 1]; k++) {
      if (adjT[k] !== 0) continue;
      const v = adj[k], pl = cPlace[c] === cPlace[v] ? cPlace[c] : cPlace[c];
      if (!out.has(pl)) out.set(pl, []);
      out.get(pl).push({ p: cProt[v], c: v, here: isThere(c) && isThere(v), across: cPlace[c] !== cPlace[v] ? cPlace[v] : -1 });
    }
  }
  return out;
}
const placeName = k => PLACES[k][1];
const placeShort = k => PLACES[k][2];

// ------------------------------------------------------------- search box --
function matches(q, limit) {
  q = q.trim().toLowerCase();
  if (!q) return [];
  const res = [];
  for (const i of NET.pOrd) {
    const c = NET.sym[i].toLowerCase(), nm = NET.name[i].toLowerCase(), r = NET.role[i].toLowerCase();
    let s = -1;
    if (c === q) s = 0; else if (c.startsWith(q)) s = 1; else if (nm.startsWith(q)) s = 2;
    else if (nm.includes(q) || r.includes(q) || NET.pPlaces[i].some(k => placeName(k).toLowerCase().startsWith(q))) s = 3;
    if (s >= 0) res.push([s, i]);
  }
  return res.sort((a, b) => a[0] - b[0]).slice(0, limit || 8).map(r => r[1]);
}
const findProtein = s => { const m = matches(s, 1); return m.length ? m[0] : -1; };
const wherePlaces = p => NET.pPlaces[p].map(placeShort).join(', ');
function attachSuggest(input, list, onPick) {
  let items = [], hi = -1;
  const close = () => { list.classList.remove('on'); input.setAttribute('aria-expanded', 'false'); hi = -1; };
  const render = () => {
    const q = input.value;
    items = /\s(to|-|–|>)\s/i.test(q) ? [] : matches(q, 8);
    if (!items.length) { close(); return; }
    list.innerHTML = items.map((i, k) => `<li role="option" data-i="${i}" aria-selected="${k === hi}"><b>${esc(NET.sym[i])}</b><span>${esc(NET.name[i])}, ${esc(NET.role[i])}</span><em>${esc(wherePlaces(i))}</em></li>`).join('');
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
    const s = findProtein(parts[0]), t = findProtein(parts[1]);
    showTab('path');
    $('#pf').value = s >= 0 ? NET.sym[s] : parts[0]; $('#pt').value = t >= 0 ? NET.sym[t] : parts[1];
    runPath(s, t);
  } else {
    const i = findProtein(q);
    if (i >= 0) { showTab('protein'); selectProtein(i); } else renderProtein(-2, q);
  }
}

// ------------------------------------------------------------------ panes --
const TABS = [['protein', 'Protein'], ['path', 'Paths'], ['places', 'Places'], ['moves', 'Moves'], ['prox', 'Proximity']];
const PATH_PRESETS = [['EGF', 'SRF', 'EGF to SRF'], ['TNF', 'RELA', 'TNF to NF-κB'], ['SCAP', 'CREBBP', 'SCAP to CBP']];
const PROX_PRESETS = ['LAMTOR1', 'SEC61B', 'NUP153', 'TOMM20', 'EGFR'];
const QUICK = ['CTNNB1', 'RELA', 'TP53', 'KPNB1', 'CFTR', 'TARDBP'];
function buildExplore() {
  $('#explore').innerHTML = `
    <div class="search"><input id="q" type="search" placeholder="Search a protein, or type EGF to SRF" autocomplete="off" spellcheck="false" aria-label="Search proteins or a path" role="combobox" aria-expanded="false" aria-controls="qs"><ul class="sugg" id="qs" role="listbox"></ul></div>
    <div class="tabs" role="tablist">${TABS.map(([k, n]) => `<button role="tab" type="button" data-tab="${k}" aria-selected="${k === 'protein'}">${n}</button>`).join('')}</div>
    ${TABS.map(([k]) => `<div class="pane${k === 'protein' ? ' on' : ''}" id="pane-${k}" role="tabpanel"></div>`).join('')}`;
  attachSuggest($('#q'), $('#qs'), (i, text) => {
    if (i !== null && i !== undefined) { $('#q').value = NET.sym[i]; showTab('protein'); selectProtein(i); } else runQuery(text);
  });
  document.querySelectorAll('.tabs button').forEach(b => b.addEventListener('click', () => showTab(b.dataset.tab)));
  $('#pane-path').innerHTML = `
    <h3>Shortest paths</h3><p class="sub">Fewest steps between two proteins. A step is a binding, or a move from one place to another.</p>
    <div class="row"><div class="field"><label for="pf">From</label><input id="pf" autocomplete="off" spellcheck="false"><ul class="sugg" id="pfs"></ul></div>
    <div class="field"><label for="pt">To</label><input id="pt" autocomplete="off" spellcheck="false"><ul class="sugg" id="pts"></ul></div></div>
    <div class="actions"><button class="btn primary" type="button" id="pgo">Find shortest path</button>
    ${PATH_PRESETS.map(([s, t, n]) => `<button class="btn" type="button" data-pre="${s} ${t}">${n}</button>`).join('')}
    <button class="btn" type="button" id="prand">Random pair</button></div><div id="presult"></div>`;
  const pickField = id => (i, text) => { const v = i !== null && i !== undefined ? i : findProtein(text); if (v >= 0) $(id).value = NET.sym[v]; };
  attachSuggest($('#pf'), $('#pfs'), pickField('#pf'));
  attachSuggest($('#pt'), $('#pts'), pickField('#pt'));
  $('#pgo').addEventListener('click', () => runPath(findProtein($('#pf').value), findProtein($('#pt').value)));
  $('#pane-path').querySelectorAll('[data-pre]').forEach(b => b.addEventListener('click', () => {
    const [s, t] = b.dataset.pre.split(' ');
    $('#pf').value = s; $('#pt').value = t; runPath(A(s), A(t));
  }));
  $('#prand').addEventListener('click', () => {
    const r = Math.random, s = Math.floor(r() * NET.P), t = Math.floor(r() * NET.P);
    $('#pf').value = NET.sym[s]; $('#pt').value = NET.sym[t]; runPath(s, t);
  });
  renderProtein(-1); renderPlaces(); renderMoves(); renderProx(); renderPathResult();

  // view controls in the bottom bar
  const seg = (name, opts) => `<div class="seg" data-ctl="${name}" role="group" aria-label="${name}">${opts.map(([v, n]) => `<button type="button" data-v="${v}" aria-pressed="${X[name] === v}">${n}</button>`).join('')}</div>`;
  $('#viewctl').innerHTML = `
    <div class="grp"><span>Color</span>${seg('color', [['place', 'Place'], ['multi', 'Addresses'], ['deg', 'Partners'], ['plain', 'Plain']])}</div>
    <div class="grp"><span>Organelles</span>${seg('cell', [['on', 'On'], ['faint', 'Faint'], ['off', 'Off']])}</div>
    <div class="grp opt"><span>Interaction lines</span><input type="range" id="rta" min="0" max="1.6" step="0.05" value="${X.routes}" aria-label="Interaction line brightness"></div>`;
  $('#viewctl [data-v="multi"]').title = 'Number of places a protein is found in: grey one, amber two, teal three';
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
  if (k !== 'places' && X.iso >= 0) { X.iso = -1; renderPlaces(); }
  if (k === 'prox' && X.bait < 0) setBait(X.selCopy >= 0 ? X.selCopy : CP('LAMTOR1'), false);
  if (k === 'prox') renderProx();
  updateExtraLabels();
}
const chip = (p, c) => `<button type="button" data-i="${p}" title="${esc(NET.name[p])}, ${esc(NET.role[p])}">${c !== undefined ? `<span class="sw" style="background:${placeCss(c)}"></span>` : ''}${esc(NET.sym[p])}</button>`;
function renderProtein(i, q) {
  const pane = $('#pane-protein');
  if (i < 0) {
    pane.innerHTML = `${i === -2 ? `<p class="empty">No protein matches “${esc(q)}”. Try a gene symbol like TP53, or a name like insulin.</p>` : '<p class="empty">Search above, or click any protein in the cell, to see where it works and whom it meets there.</p>'}
      <div class="quick">${QUICK.map(c => `<button type="button" data-c="${c}">${c} ${esc(NET.name[A(c)])}</button>`).join('')}</div>`;
    pane.querySelectorAll('[data-c]').forEach(b => b.addEventListener('click', () => selectProtein(A(b.dataset.c))));
    return;
  }
  const { sym, name, role, pPlaces, pCopies, pDeg } = NET;
  const info = reachInfo(i), groups = partnersByPlace(i);
  const moves = MOVES.filter(m => [m.rest, m.on, m.gone, m.fail].join(' ').split(/\s+/).some(t => t.split('@')[0] === sym[i]));
  const where = pCopies[i].map(c => `<li><span class="sw" style="background:${placeCss(NET.cPlace[c])}"></span>${esc(placeName(NET.cPlace[c]))}${isThere(c) ? '' : ' <small>(not now)</small>'}</li>`).join('');
  pane.innerHTML = `<h3>${esc(sym[i])} ${esc(name[i])}</h3><p class="sub">${esc(role[i])}</p>
    <dl class="stats">
      <dt>Found in</dt><dd><ul class="wherelist">${where}</ul></dd>
      <dt>Partners</dt><dd>${pDeg[i]}<small>${pDeg[i] === 1 ? 'protein binds it' : 'proteins bind it'}</small></dd>
      <dt>Reach</dt><dd>${info.n ? `${info.avg.toFixed(2)} steps on average to ${fmt(info.n)} proteins<small>farthest: ${info.fd} steps, to ${esc(sym[info.far])}</small>` : 'No connections right now'}</dd>
      ${moves.length ? `<dt>Moves</dt><dd>${moves.map(m => `<button class="btn" type="button" data-mv="${m.key}" style="padding:3px 9px;font-size:13px;margin:0 6px 4px 0">${esc(m.name)}</button>`).join('')}</dd>` : ''}
    </dl>
    <div class="actions"><button class="btn" type="button" id="aPath">Find a path from here</button><button class="btn" type="button" id="aProx">Tag its neighbours</button></div>
    ${[...groups.entries()].map(([pl, l]) => `<p class="grp-h"><span class="sw" style="background:${placeCss(pl)}"></span>${l.length} in the ${esc(placeShort(pl))}${pPlaces[i].length > 1 || l.some(x => x.across >= 0) ? '' : ''}</p>
      <div class="chips">${l.map(x => chip(x.p, x.across >= 0 ? x.across : undefined)).join('')}</div>`).join('') || '<p class="empty">No interactions in this map.</p>'}`;
  pane.querySelectorAll('.chips').forEach(el => el.addEventListener('click', ev => { const b = ev.target.closest('[data-i]'); if (b) selectProtein(+b.dataset.i); }));
  pane.querySelectorAll('[data-mv]').forEach(b => b.addEventListener('click', () => { showTab('moves'); setMove(MV[b.dataset.mv], !X.scen[MV[b.dataset.mv]]); }));
  $('#aPath').addEventListener('click', () => { $('#pf').value = sym[i]; $('#pt').value = ''; showTab('path'); $('#pt').focus(); });
  $('#aProx').addEventListener('click', () => { setBait(X.selCopy >= 0 ? X.selCopy : pCopies[i][0]); showTab('prox'); });
}
function selectProtein(i, fly = true, copy) {
  X.sel = i;
  if (i >= 0) {
    const cs = NET.pCopies[i];
    X.selCopy = copy !== undefined ? copy : cs.find(isThere) ?? cs[0];
    const pairs = [];
    for (const c of cs) for (let k = NET.adjS[c]; k < NET.adjS[c + 1]; k++) if (NET.adjT[k] === 0) pairs.push([c, NET.adj[k]]);
    setHighlight('sel', pairs, [0.30, 0.88, 1.0], { radius: 0.0016, spread: 0.5, seed: i + 1 });
    XS.sel_prog = 0;
    if (fly) {
      const cen = cs.reduce((s, c) => v3.add(s, cpos(c)), [0, 0, 0]), [la, lo] = latLonOf(cen);
      const spread = cs.length > 1 ? Math.max(...cs.map(c => v3.len(v3.sub(cpos(c), v3.mul(cen, 1 / cs.length))))) : 0;
      flyTo(la, lo, clamp(1.3 + 2.4 * spread, 1.3, 2.8));
    }
    if (fly && X.tab !== 'protein' && X.tab !== 'path') showTab('protein');
  } else { X.selCopy = -1; setHighlight('sel', null); }
  renderProtein(i);
  updateExtraLabels();
}
function runPath(s, t, fly = true) {
  X.pathErr = null;
  if (s < 0 || t < 0) X.pathErr = 'Pick two proteins from the suggestions, for example EGF and SRF.';
  else if (s === t) X.pathErr = 'Pick two different proteins.';
  const res = X.pathErr ? null : bestPath(s, t);
  if (!X.pathErr && !res) X.pathErr = 'No path connects these proteins in this cell right now. Some paths open up once proteins move: try the Moves tab.';
  X.path = res ? res.path : null; X.count = res ? res.count : 0; X.pathEnds = [s, t];
  XS.path_prog = 0;
  setFocus(X.path, true);
  setHighlight('xpath', X.path ? X.path.slice(0, -1).map((p, k) => [p, X.path[k + 1]]) : null, SIG,
    { radius: 0.0042, fade: SIG_A, hops: X.path ? X.path.slice(0, -1).map((_, k) => k + 1) : null });
  renderPathResult(); updateExtraLabels();
  if (X.path && fly) {
    const cen = X.path.reduce((a, c) => v3.add(a, cpos(c)), [0, 0, 0]), n = X.path.length, m = v3.mul(cen, 1 / n);
    const spread = Math.max(...X.path.map(c => v3.len(v3.sub(cpos(c), m))));
    const [la, lo] = latLonOf(cen);
    flyTo(la, lo, clamp(1.2 + 3.0 * spread, 1.4, 3.6));
  }
}
function pathSteps(p) {
  const { sym, cProt, cPlace } = NET;
  return p.slice(0, -1).map((a, k) => {
    const b = p[k + 1];
    if (cProt[a] === cProt[b]) return { move: true, text: `<b>${esc(sym[cProt[a]])}</b> moves into the ${esc(placeShort(cPlace[b]))}`, sub: `${placeName(cPlace[a])} → ${placeName(cPlace[b])}`, a, b };
    const where = cPlace[a] === cPlace[b] ? `in the ${placeShort(cPlace[a])}` : `across ${placeShort(cPlace[a])} and ${placeShort(cPlace[b])}`;
    return { move: false, text: `<b>${esc(sym[cProt[a]])}</b> binds <b>${esc(sym[cProt[b]])}</b>`, sub: where, a, b };
  });
}
function renderPathResult() {
  const el = $('#presult');
  if (!el) return;
  if (X.pathErr) { el.innerHTML = `<p class="empty">${esc(X.pathErr)}</p>`; return; }
  if (!X.path) { el.innerHTML = '<p class="empty">Choose two proteins, or try one of the examples.</p>'; return; }
  const p = X.path, L = p.length - 1, steps = pathSteps(p), moves = steps.filter(s => s.move).length;
  const places = new Set(p.map(c => NET.cPlace[c]));
  el.innerHTML = `<div class="result teal">${L} ${L === 1 ? 'step' : 'steps'}</div>
    <p class="sub">${moves ? `${moves} of them ${moves === 1 ? 'a move' : 'moves'} between places. ` : ''}The path visits ${places.size} ${places.size === 1 ? 'place' : 'places'}.
    ${X.count > 1 ? `It is one of ${fmt(X.count)} equally short paths.` : 'It is the only path this short.'}</p>
    <ol class="hops teal">${steps.map(s => `<li><div>${s.text}<br><span>${esc(s.sub)}</span></div><span></span></li>`).join('')}</ol>`;
}
function placeCounts() {
  if (X.pc) return X.pc;
  const { NC, E, eu, ev, cPlace } = NET, rest = new Array(8).fill(0);
  const s = PLACES.map(() => ({ n: 0, inside: 0, across: 0, top: [] }));
  for (let c = 0; c < NC; c++) if (present(c, rest)) s[cPlace[c]].n++;
  for (let e = 0; e < E; e++) { const a = cPlace[eu[e]], b = cPlace[ev[e]]; if (a === b) s[a].inside++; else { s[a].across++; s[b].across++; } }
  const ord = Array.from({ length: NC }, (_, c) => c).sort((x, y) => NET.cDeg[y] - NET.cDeg[x]);
  for (const c of ord) { const t = s[cPlace[c]].top, sy = NET.sym[NET.cProt[c]]; if (t.length < 3 && !t.includes(sy)) t.push(sy); }
  return (X.pc = s);
}
function renderPlaces() {
  const s = placeCounts();
  $('#pane-places').innerHTML = `<h3>Places</h3>
    <p class="sub">The compartments of the model cell. Select one to isolate it and its interactions.</p>
    <ul class="legend places">${PLACES.map((pl, k) => `<li data-k="${k}" tabindex="0" role="button" aria-pressed="${X.iso === k}"><span class="sw" style="background:${placeCss(k)}"></span>${esc(pl[1])}<em>${fmt(s[k].n)} proteins</em>
      <small>${s[k].top.length ? `Hubs ${s[k].top.join(', ')}. ` : ''}${s[k].inside} interactions inside, ${s[k].across} across its boundary.</small></li>`).join('')}</ul>`;
  const toggle = li => {
    const k = +li.dataset.k;
    X.iso = X.iso === k ? -1 : k;
    if (X.iso >= 0) {
      setView('color', 'place');
      const cs = [];
      for (let c = 0; c < NET.NC; c++) if (NET.cPlace[c] === k) cs.push(c);
      const cen = cs.reduce((a, c) => v3.add(a, cpos(c)), [0, 0, 0]), [la, lo] = latLonOf(cen), m = v3.mul(cen, 1 / cs.length);
      const spread = Math.max(...cs.map(c => v3.len(v3.sub(cpos(c), m))));
      flyTo(la, lo, clamp(1.2 + 2.6 * spread, 1.3, 3.6));
    }
    renderPlaces();
  };
  $('#pane-places').querySelectorAll('[data-k]').forEach(li => {
    li.addEventListener('click', () => toggle(li));
    li.addEventListener('keydown', ev => { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); toggle(li); } });
  });
}
function moveDelta(m) {
  const k = MV[m.key], prots = [...new Set([...m.travelers, ...m.fails].map(([f]) => NET.cProt[f]))];
  return prots.map(p => ({ p, ...ST.delta(p, k) }));
}
function renderMoves() {
  const pane = $('#pane-moves');
  if (!pane) return;
  pane.innerHTML = `<h3>Moves</h3><p class="sub">Proteins change place when the cell gets a signal, and in disease. Start a move and watch the network rewire.</p>
    <ul class="moves">${MOVES.map((m, k) => {
      const on = !!X.scen[k], d = moveDelta(m);
      return `<li class="${on ? 'on' : ''}"><div class="mh"><div><b>${esc(m.name)}</b>${m.disease ? '<span class="tag">disease</span>' : ''}<small>${esc(m.title)}</small></div>
        <button class="btn" type="button" data-k="${k}" aria-pressed="${on}">${on ? 'Undo' : m.disease ? 'Show' : 'Start'}</button></div>
        ${on ? `<p>${esc(m.text)}</p>${d.map(x => `<div class="delta"><b>${esc(NET.sym[x.p])}</b>${x.lost.length ? ` loses <span class="red">${x.lost.map(q => esc(NET.sym[q])).join(', ')}</span>` : ''}${x.lost.length && x.gained.length ? ',' : ''}${x.gained.length ? ` gains <span class="green">${x.gained.map(q => esc(NET.sym[q])).join(', ')}</span>` : ''}${!x.lost.length && !x.gained.length ? ' keeps its partners' : ''}</div>`).join('')}` : ''}</li>`;
    }).join('')}</ul>
    <div class="actions"><button class="btn" type="button" id="mvReset">Back to a resting cell</button></div>`;
  pane.querySelectorAll('[data-k]').forEach(b => b.addEventListener('click', () => {
    const k = +b.dataset.k;
    setMove(k, !X.scen[k]);
    if (X.scen[k]) {
      const m = MOVES[k], cs = [...m.travelers.flat(), ...m.fails.flat(), ...m.cueCopies];
      const cen = cs.reduce((a, c) => v3.add(a, cpos(c)), [0, 0, 0]), [la, lo] = latLonOf(cen);
      flyTo(la, lo, 2.3);
    }
  }));
  $('#mvReset').addEventListener('click', () => MOVES.forEach((_, k) => setMove(k, false)));
}
function setBait(c, render = true) {
  X.bait = c;
  if (render) renderProx();
  updateExtraLabels();
  if (c >= 0) { const [la, lo] = latLonOf(cpos(c)); flyTo(la, lo, 1.25); }
}
// shared rooms: what everyone at the station sees alike: the tab, the view controls, the selected protein (and
// which copy), the path's two ends, the isolated place, the moves, the bait and its radius (the camera, the search
// box and the headset keyboard stay each person's own)
// shared rooms: the cell's view in a headset at a station (explore mode), which turns and sizes it in the room:
// shared (HOST.collab), so everyone there sees it alike; null while it flies somewhere (a pick, a view arriving)
function collabView() {
  if (APP.mode !== 'explore' || orbit.to) return null;
  const c = orbit.cur, r = (x, k) => Math.round(x * k) / k;
  return [r(c[0], 10), r((((c[1] + 180) % 360) + 360) % 360 - 180, 10), r(c[2], 100), r(c[3], 10), r(c[4], 10)];
}
function collabSetView(v) {
  if (APP.mode !== 'explore' || !Array.isArray(v) || v.length !== 5 || !v.every(Number.isFinite)) return;
  const c = orbit.cur, to = v.slice();
  to[1] += 360 * Math.round((c[1] - to[1]) / 360);
  Object.assign(orbit, { from: c.slice(), to, t0: performance.now(), fast: true });   // a short glide there
}
function collabState() {
  return { tab: X.tab, color: X.color, cell: X.cell, routes: X.routes, sel: X.sel, copy: X.selCopy,
    path: (X.path || X.pathErr) && X.pathEnds ? X.pathEnds.slice() : null, iso: X.iso, moves: X.scen.join(''), bait: X.bait, r: X.proxR };
}
// shows a shared state with the story's own setters (no camera flights), dependencies first; ignores what is not valid
function collabApply(v) {
  if (!v || typeof v !== 'object') return;
  const int = (x, lo, hi) => Number.isInteger(x) && x >= lo && x < hi, num = (x, lo, hi) => typeof x === 'number' && x >= lo && x <= hi;
  if (['place', 'multi', 'deg', 'plain'].includes(v.color) && X.color !== v.color) setView('color', v.color);
  if (['on', 'faint', 'off'].includes(v.cell) && X.cell !== v.cell) setView('cell', v.cell);
  if (num(v.routes, 0, 1.6) && X.routes !== v.routes) { X.routes = v.routes; $('#rta').value = v.routes; }
  if (num(v.r, 0.03, 0.16) && X.proxR !== v.r) { X.proxR = v.r; $('#pxr').value = v.r; renderProx(); }
  if (typeof v.moves === 'string' && /^[01]*$/.test(v.moves) && v.moves.length === MOVES.length)
    MOVES.forEach((_, j) => { const on = v.moves[j] === '1'; if (!!X.scen[j] !== on) setMove(j, on); });
  if (int(v.sel, -1, NET.P) && (v.sel < 0 || NET.pCopies[v.sel].includes(v.copy)) && (X.sel !== v.sel || (v.sel >= 0 && X.selCopy !== v.copy))) {
    selectProtein(v.sel, false, v.sel >= 0 ? v.copy : undefined);
    if (v.sel >= 0 && document.activeElement !== $('#q')) $('#q').value = NET.sym[v.sel];
  }
  const pe = v.path, cur = collabState().path;
  if (pe === null && cur) xrClearPath();
  else if (Array.isArray(pe) && pe.length === 2 && pe.every(x => int(x, -1, NET.P)) && !(cur && cur[0] === pe[0] && cur[1] === pe[1])) {
    XR.pf = pe[0]; XR.pt = pe[1]; XR.pick = 'to';
    if (pe[0] >= 0) $('#pf').value = NET.sym[pe[0]];
    if (pe[1] >= 0) $('#pt').value = NET.sym[pe[1]];
    runPath(pe[0], pe[1], false);
  }
  // the bait before the tab: opening Proximity without one picks one (and flies there)
  if (int(v.bait, -1, NET.NC) && X.bait !== v.bait) { X.bait = v.bait; renderProx(); updateExtraLabels(); }
  if (TABS.some(([k]) => k === v.tab) && X.tab !== v.tab) showTab(v.tab);
  if (int(v.iso, -1, PLACES.length) && X.iso !== v.iso) { X.iso = v.iso; renderPlaces(); }
}
function proxTagged() {
  const b = X.bait, out = [];
  if (b < 0) return out;
  const bp = NET.partners[NET.cProt[b]];
  for (let c = 0; c < NET.NC; c++) {
    if (c === b || !isThere(c)) continue;
    const d = v3.len(v3.sub(cpos(c), cpos(b)));
    if (d < X.proxR) out.push({ c, d, partner: bp.has(NET.cProt[c]), same: NET.cProt[c] === NET.cProt[b] });
  }
  return out.sort((x, y) => x.d - y.d);
}
function renderProx() {
  const pane = $('#pane-prox');
  if (!pane) return;
  if (!pane.dataset.built) {
    pane.dataset.built = 1;
    pane.innerHTML = `<h3>Proximity labelling</h3>
      <p class="sub">An enzyme fused to a bait protein tags every protein nearby. Pick a bait, then change how far the tags reach.</p>
      <div class="quick" id="pxq">${PROX_PRESETS.map(s => `<button type="button" data-c="${s}">${s} ${esc(placeShort(NET.cPlace[CP(s)]))}</button>`).join('')}</div>
      <label for="pxr" class="caption" style="display:block;margin-top:14px">Labelling radius</label>
      <input type="range" id="pxr" min="0.03" max="0.16" step="0.005" value="${X.proxR}" style="accent-color:var(--green)">
      <div id="pxres"></div>
      <p class="caption" style="margin-top:12px">Real labelling reaches about ten nanometres; the model draws it far larger.</p>`;
    $('#pxq').addEventListener('click', ev => { const b = ev.target.closest('[data-c]'); if (b) setBait(CP(b.dataset.c)); });
    $('#pxr').addEventListener('input', ev => { X.proxR = +ev.target.value; renderProx(); });
  }
  const el = $('#pxres');
  if (X.bait < 0) { el.innerHTML = '<p class="empty">Pick a bait above, or select a protein and press Tag its neighbours.</p>'; return; }
  const b = X.bait, t = proxTagged(), part = t.filter(x => x.partner).length;
  el.innerHTML = `<div class="result green">${t.length}</div><p class="sub">proteins tagged around <b>${esc(NET.sym[NET.cProt[b]])}</b> in the ${esc(placeShort(NET.cPlace[b]))}. ${!t.length ? 'Make the radius larger.' : part === t.length ? (part === 1 ? 'It binds the bait directly.' : 'All of them bind it directly.') : part ? `${part} of them bind it directly; the others are neighbours.` : 'None of them binds it directly: they are neighbours.'}</p>
    <ul class="prox-list">${t.slice(0, 40).map(x => `<li class="${x.partner ? 'pt' : ''}"><b>${esc(NET.sym[NET.cProt[x.c]])}</b><span>${esc(placeShort(NET.cPlace[x.c]))}</span></li>`).join('')}</ul>
    ${t.length > 40 ? `<p class="caption">and ${t.length - 40} more</p>` : ''}<p class="caption"><span class="teal">Teal</span>: direct partners of the bait.</p>`;
}
function updateExtraLabels() {
  LBL.extra.forEach(L => { L.el.remove(); dropSprite(L); });
  LBL.extra = [];
  const add = (i, html, cls) => {
    const el = document.createElement('div');
    el.className = 'lbl ' + cls; el.innerHTML = html; el.style.opacity = 0;
    $('#labels').appendChild(el);
    LBL.extra.push({ el, i, o: -1 });
  };
  const { sym, cProt, cPlace } = NET;
  if (X.path && X.tab === 'path') X.path.forEach((c, k) => { if (k === 0 || cProt[c] !== cProt[X.path[k - 1]]) add(c, `<b>${sym[cProt[c]]}</b>${esc(placeShort(cPlace[c]))}`, 'tl'); });
  if (X.tab === 'prox' && X.bait >= 0) add(X.bait, `<b>${sym[cProt[X.bait]]}</b>bait`, 'grn');
  if (X.sel >= 0 && !(X.path && X.tab === 'path' && X.path.some(c => cProt[c] === X.sel)))
    NET.pCopies[X.sel].forEach(c => { if (isThere(c)) add(c, `<b>${sym[X.sel]}</b>${esc(placeShort(cPlace[c]))}`, 'cyn'); });
}

// ------------------------------------------------------- cell interaction --
const M4 = new THREE.Matrix4();
function pickCopy(mx, my) {
  const cam = GL.camera, e = M4.multiplyMatrices(cam.projectionMatrix, cam.matrixWorldInverse).elements;
  const w = window.innerWidth, h = window.innerHeight;
  let best = -1, bd = 196;
  for (let c = 0; c < NET.NC; c++) {
    if (!isThere(c) || (X.iso >= 0 && NET.cPlace[c] !== X.iso)) continue;
    const x = POS[3 * c], y = POS[3 * c + 1], z = POS[3 * c + 2];
    const W = e[3] * x + e[7] * y + e[11] * z + e[15];
    if (W <= 0) continue;
    const sx = ((e[0] * x + e[4] * y + e[8] * z + e[12]) / W * 0.5 + 0.5) * w, sy = (-(e[1] * x + e[5] * y + e[9] * z + e[13]) / W * 0.5 + 0.5) * h;
    const d2 = (sx - mx) ** 2 + (sy - my) ** 2 - 40 * Math.sqrt(NET.cDeg[c] / NET.maxCDeg) - W * 2;
    if (d2 < bd) { bd = d2; best = c; }
  }
  return best;
}
function clickCopy(c) {
  if (X.tab === 'prox') { setBait(c); return; }
  $('#q').value = NET.sym[NET.cProt[c]];
  selectProtein(NET.cProt[c], true, c);
}
function flyTo(lat, lon, dist) {
  const c = orbit.cur;
  orbit.from = c.slice();
  orbit.to = [clamp(lat * 0.85, -70, 75), lon + 360 * Math.round((c[1] - lon) / 360), dist, 0, 0];
  orbit.t0 = performance.now(); orbit.fast = false;
}
function orbitStep(now) {
  if (!orbit.to) return;
  const x = smooth((now - orbit.t0) / ((orbit.fast ? 0.25 : orbit.dur) * 1000)), f = orbit.from, t = orbit.to;   // fast: a view from the room
  orbit.cur = f.map((v, k) => (k === 2 ? Math.exp(Math.log(v) + (Math.log(t[k]) - Math.log(v)) * x) : v + (t[k] - v) * x));
  if (x >= 1) { orbit.to = null; orbit.fast = false; }
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
    const c = pickCopy(ev.clientX, ev.clientY);
    cv.style.cursor = c >= 0 ? 'pointer' : 'grab';
    if (c >= 0) {
      const p = NET.cProt[c];
      tip.innerHTML = `<b>${esc(NET.sym[p])}</b>${esc(NET.role[p])}, ${esc(placeShort(NET.cPlace[c]))}`;
      tip.style.transform = `translate(${ev.clientX + 14}px, ${ev.clientY + 12}px)`;
      tip.style.opacity = 1;
    } else tip.style.opacity = 0;
  });
  const end = ev => {
    pts.delete(ev.pointerId);
    if (pts.size < 2) pinch = 0;
    if (APP.mode === 'explore' && down && !down.moved && ev.type === 'pointerup') {
      const c = pickCopy(ev.clientX, ev.clientY);
      if (c >= 0) clickCopy(c);
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
// point at, and labels become sprites on top or signs in the scene. Controllers: point and pull the trigger
// to click, drag the globe with the trigger or grip, thumbstick spins and zooms,
// A/X plays and pauses the story. Hand tracking: point and pinch.
const XR = {
  on: false, mode: null, session: null, needRecenter: false, fov: false, fontOK: 0, clear: true,
  head: new THREE.Vector3(), headQ: new THREE.Quaternion(), globeOff: new THREE.Vector3(), size: 1, globeBase: new THREE.Vector3(), camLocal: new THREE.Vector3(0, 0, 5),
  rot: new THREE.Quaternion(), free: false, lm: 'face', signL: new THREE.Quaternion(), signH: new THREE.Vector3(),
  baseR: 0.36, R: 0.36, viewH: 1600, pointK: 0.0028, hlScale: 1.4,
  ctrls: [], panels: [], main: null, foot: null, tip: null, tipI: -1, elInfo: null,
  kbd: { open: false, q: '' }, pf: -1, pt: -1, pick: 'from', aiKey: '', ai: null, ccKey: '', cc: null,
};
const _xd = new THREE.Vector3(), _xp = new THREE.Vector3(), _xq = new THREE.Quaternion();
const _xq2 = new THREE.Quaternion(), _xm = new THREE.Matrix4(), _xinv = new THREE.Matrix4();
const _xa = new THREE.Vector3(), _xb = new THREE.Vector3(), _xc = new THREE.Vector3(), _xz = new THREE.Vector3(0, 0, 1);
const _xY = new THREE.Vector3(0, 1, 0);

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
  XR.R = XR.baseR * clamp(Math.pow(4.6 / (d + 1), 0.8), 0.72, 2.0) * XR.size;   // (times the size your hands or the room gave it)
  // a little right of centre and below eye level, leaving room for the panel on the left
  const dc = Math.max(1.2, XR.R / XR.size + 0.62), cx = 0.3, cy = -0.2;   // (from the story's own size: resizing does not move it away)
  // plus wherever you have moved it with the grip; the story's focus side keeps facing you (moving freely, it keeps
  // the turn its home place gives it, times the turn you gave it, XR.rot)
  const gx = cx + XR.globeOff.x, gy = cy + XR.globeOff.y, gz = -dc + XR.globeOff.z;
  XR.globeBase.set(cx, cy, -dc);
  xrFace(_xq2, gx, gy, gz);
  GL.world.position.set(gx, gy, gz);
  GL.world.quaternion.copy(_xq2).multiply(_xq);
  GL.world.scale.setScalar(XR.R);
}
function xrRecenter() {
  XR.globeOff.set(0, 0, 0); XR.size = 1; XR.rot.identity();
  if (XR.panelGroup) xrPanelPose(XR.panelHome.p, XR.panelHome.yaw);
  // anchored: the scene and the panel go back where they were saved with the place
  const s = HOST.anchor.saved();
  if (s) { XR.globeOff.fromArray(s.off); XR.size = s.s || 1; xrSceneRot(s.q); if (XR.panelGroup) xrPanelPose(s.pp, s.pr, s.pq); }
  const yaw = new THREE.Euler().setFromQuaternion(XR.headQ, 'YXZ').y;
  GL.rig.position.copy(XR.head);
  GL.rig.quaternion.setFromAxisAngle(new THREE.Vector3(0, 1, 0), yaw);
}

// ------------------------------------------------- labels and free moving --
// The shell's two headset settings, the same for everyone in a shared room (HOST.xr; read every frame, and a shell
// without them means labels on top and nothing free): labels 'face' (on top: sprites turned to you, over everything),
// 'fixed' (in 3D: upright signs in the scene, turned to you) or 'hidden'; free moving holds what the grip takes like a
// real object.
const xrLabelMode = () => (HOST.xr && HOST.xr.labels ? HOST.xr.labels() : 'face');
const xrFreeOn = () => !!(HOST.xr && HOST.xr.free && HOST.xr.free());
const xrSig = () => (HOST.xr && HOST.xr.sig ? HOST.xr.sig() : '');
// a headset in a shared room (the shell's HOST.room): no Stories screen there, a story runs only at its station (reached
// by walking into its circle), and away from one it is hidden, not pointable, paused and silent. A shell without
// HOST.room.away: as before (only at a station is the story the station's)
const xrRoomOnly = () => !!(HOST.room && HOST.room.away && HOST.room.inRoom());
const xrAway = () => !!(HOST.room && HOST.room.away && HOST.room.away());
const _fq = new THREE.Quaternion(), _fv = new THREE.Vector3();
// the yaw of a turn: where its front (+z) points along the floor (def when it points straight up or down)
function yawOf(q, def) { _fv.set(0, 0, 1).applyQuaternion(q); return Math.hypot(_fv.x, _fv.z) < 1e-4 ? +def || 0 : Math.atan2(_fv.x, _fv.z); }
// a turn from the shell or the room ([x, y, z, w] or a quaternion) into q; false when there is none
function xrQ(v, q) {
  if (v && v.isQuaternion) { q.copy(v); return true; }
  if (!Array.isArray(v) || v.length !== 4 || !v.every(Number.isFinite) || !v.some(x => x)) return false;
  q.fromArray(v).normalize();
  return true;
}
// the scene's own turn (free moving only: otherwise it faces you)
function xrSceneRot(q) { if (!(xrFreeOn() && xrQ(q, XR.rot))) XR.rot.identity(); }
// the story panel at p in the rig, upright at yaw, or (free moving) held at the turn q
function xrPanelPose(p, yaw, q) {
  const g = XR.panelGroup;
  if (p && p.isVector3) g.position.copy(p); else if (p) g.position.fromArray(p);
  if (!(xrFreeOn() && xrQ(q, g.quaternion))) g.rotation.set(0, +yaw || 0, 0);
}
// a turn of the hand (in the room) as a turn in the rig's frame, where the scene and the panel hang
function xrRigTurn(q, out) { return out.copy(GL.rig.quaternion).invert().multiply(q).multiply(_fq.copy(GL.rig.quaternion)); }
// the scene's facing, into q: from its placement point (gx, gy, gz) towards you; moving freely, from its home place,
// then turned by XR.rot
function xrFace(q, gx, gy, gz) {
  if (XR.free) _fv.copy(XR.globeBase).negate(); else _fv.set(-gx, -gy, -gz);
  q.setFromUnitVectors(_xz, _fv.normalize());
  if (XR.free) q.premultiply(XR.rot);
  return q;
}
// once a frame: the settings as they are now; free moving turned off gives the scene back its facing and stands the
// panel up again (its yaw kept), and turned on it keeps the scene's facing as it is (no jump)
function xrSettings() {
  XR.lm = xrLabelMode();
  const free = xrFreeOn();
  if (free === XR.free) return;
  if (!free) { XR.rot.identity(); XR.panelGroup.rotation.set(0, yawOf(XR.panelGroup.quaternion, 0), 0); }
  else if (XR.globeOff.lengthSq() > 1e-8) {
    _fv.copy(XR.globeBase).add(XR.globeOff).negate().normalize();
    XR.rot.setFromUnitVectors(_xz, _fv).multiply(_fq.setFromUnitVectors(_xz, _fv.copy(XR.globeBase).negate().normalize()).invert());
  } else XR.rot.identity();
  XR.free = free;
}

// ---------------------------------------------------------------- labels --
const LBL_STYLE = { '': ['#f2f6fc', null], tl: ['#cbfff3', '#38e6c7'], amb: ['#ffe2b0', '#ffb43b'],
  grn: ['#c9ffe3', '#3ee08f'], cyn: ['#d2f6ff', '#46d9ff'], tip: ['#e7eef8', '#46d9ff'] };
// a label's picture, shared by its sprite and its sign
function labelTex(L) {
  if (L.ltex) return L.ltex;
  let bold, rest, cls;
  if (L.txt) [bold, rest, cls] = L.txt;
  else {
    const b = L.el.querySelector('b');
    bold = b ? b.textContent : ''; rest = L.el.textContent.slice(bold.length).trim();
    cls = ['tl', 'amb', 'grn', 'cyn'].find(k => L.el.classList.contains(k)) || '';
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
  return (L.ltex = { tex, aspect: cv.width / H, tip: cls === 'tip' });
}
// labels on top: a sprite turned to you, drawn over everything, beside its point
function labelSprite(L) {
  if (L.sprite) return L.sprite;
  const t = labelTex(L);
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: t.tex, transparent: true, depthTest: false, depthWrite: false }));
  sp.renderOrder = t.tip ? 11 : 10;
  sp.userData.aspect = t.aspect;
  sp.center.set(-0.35 / sp.userData.aspect, 0.5);
  GL.world.add(sp);
  return (L.sprite = sp);
}
// labels in 3D: a flat sign at the sprite's place and size, turned to you each frame, readable from both sides (a quad facing +z and one facing
// -z with its picture flipped, so its text never reads mirrored), in the scene's depth: what stands in front of it
// hides it, and it hides what is behind it (drawn first of the see-through things; its clear corners cut away)
function labelSign(L) {
  if (L.sign) return L.sign;
  const t = labelTex(L), a = 0.35 / t.aspect, b = a + 1;   // (in its width, as the sprite's centre)
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute([a, -0.5, 0, b, -0.5, 0, b, 0.5, 0, a, 0.5, 0, a, -0.5, 0, b, -0.5, 0, b, 0.5, 0, a, 0.5, 0], 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute([0, 0, 1, 0, 1, 1, 0, 1, 1, 0, 0, 0, 0, 1, 1, 1], 2));
  g.setIndex([0, 1, 2, 0, 2, 3, 4, 6, 5, 4, 7, 6]);
  const sg = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ map: t.tex, transparent: true, alphaTest: 0.1 }));
  sg.renderOrder = -1;
  sg.userData.aspect = t.aspect;
  GL.world.add(sg);
  return (L.sign = sg);
}
function dropSprite(L) {
  if (!L) return;
  for (const k of ['sprite', 'sign']) {
    const o = L[k];
    if (!o) continue;
    if (o.parent) o.parent.remove(o);
    if (k === 'sign') o.geometry.dispose();
    o.material.dispose();
    L[k] = null;
  }
  if (L.ltex) { L.ltex.tex.dispose(); L.ltex = null; }
}
function hideLabelXR(L) { if (L.sprite) L.sprite.visible = false; if (L.sign) L.sign.visible = false; }
function placeLabelXR(L, alpha, S) {
  // on top (a sprite), in 3D (a sign) or hidden, as the shell's setting says; the pointer's tip is always a sprite
  const m = L === XR.tip ? 'face' : XR.lm, fixed = m === 'fixed';
  if (alpha <= 0.001 || m === 'hidden') { hideLabelXR(L); return; }
  if (fixed ? L.sprite : L.sign) (fixed ? L.sprite : L.sign).visible = false;
  const sp = fixed ? labelSign(L) : labelSprite(L), o = alpha;
  sp.visible = o > 0.01;
  sp.material.opacity = o;
  labelPos(L, sp.position);
  const hm = 0.021 / XR.R;
  sp.scale.set(hm * sp.userData.aspect, hm, 1);
  if (fixed) {
    // upright and turned to you, about the vertical only (the rig's frame): a sign in the scene, not a sprite on top
    _fv.copy(sp.position).applyMatrix4(GL.world.matrix);
    sp.quaternion.copy(XR.signL).multiply(_fq.setFromAxisAngle(_xY, Math.atan2(XR.signH.x - _fv.x, XR.signH.z - _fv.z)));
  }
}
function xrTip(S) {
  let i = -1;
  if (APP.mode === 'explore') for (const c of XR.ctrls) if (c.hover && c.hover.kind === 'globe' && c.hover.i >= 0) { i = c.hover.i; break; }
  if (i !== XR.tipI) {
    XR.tipI = i;
    if (XR.tip) dropSprite(XR.tip);
    XR.tip = i >= 0 ? { i, txt: [NET.sym[NET.cProt[i]], `${NET.role[NET.cProt[i]]}, ${placeShort(NET.cPlace[i])}`, 'tip'] } : null;
  }
  if (XR.tip) placeLabelXR(XR.tip, 1, S);
}

// ------------------------------------------------------- picking in the cell --
// Closest protein to a ray, in cell coordinates. Like the screen version,
// big hubs win ties; proteins that are not there right now are skipped.
function pickCopyRay(o, d) {
  const { NC, cDeg, maxCDeg } = NET;
  let best = -1, bs = Infinity;
  for (let c = 0; c < NC; c++) {
    if (!isThere(c) || (X.iso >= 0 && NET.cPlace[c] !== X.iso)) continue;
    const vx = POS[3 * c] - o.x, vy = POS[3 * c + 1] - o.y, vz = POS[3 * c + 2] - o.z, t = vx * d.x + vy * d.y + vz * d.z;
    if (t <= 0) continue;
    const ang = Math.sqrt(Math.max(0, vx * vx + vy * vy + vz * vz - t * t)) / t;
    if (ang > 0.026) continue;
    const sc = ang - 0.008 * Math.sqrt(cDeg[c] / maxCDeg) + t * 0.004;
    if (sc < bs) { bs = sc; best = c; }
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
  if (h.kind === 'shell') { HOST.collab.press(c.i); return; }   // the shared room's panel, previews, calibration
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
  } else if (!p.moved && p.i >= 0) { buzz(c); xrClickCopy(p.i); }
}
function xrGrab(c, on) {
  c.grab = null;
  const h = c.hover;
  if (!on || !h) return;
  if (XR.stories || HOST.anchor.locked(h.kind)) return; // the Stories screen stays put, and so does an anchored place (in a shared room: only at its station, unless locked)
  const obj = h.kind === 'panel' ? XR.panelGroup : GL.world;
  c.grab = { target: h.kind === 'panel' ? 'panel' : 'globe', q0: new THREE.Quaternion().setFromRotationMatrix(c.g.matrix).invert(),
    o0: c.o.clone(), p0: obj.getWorldPosition(new THREE.Vector3()), reach: 1, r0: (h.kind === 'panel' ? XR.panelGroup.quaternion : XR.rot).clone() };
  buzz(c, 0.4, 25);
}
const _gq = new THREE.Quaternion(), _gv = new THREE.Vector3(), _gh = new THREE.Vector3(), _gr = new THREE.Quaternion();
// the grabbed object keeps its offset from the controller, so moving or turning your hand carries it (moving freely,
// it also turns with your hand, about it: what you hold stays in your hand)
function carry(c, dt) {
  const G = c.grab, gp = c.src.gamepad;
  // both hands on the scene resize it (xrResize, once a frame); when one lets go, the other carries on from there
  if (HOST.anchor.locked(G.target === 'panel' ? 'panel' : 'globe')) { c.grab = null; return; }   // locked meanwhile (a shared room's layout lock)
  const o = G.target === 'globe' ? XR.ctrls.find(k => k !== c && k.grab && k.grab.target === 'globe' && k.src && k.g.visible) : null;
  if (o) { if (c.i > o.i) xrResize(o, c); return; }
  if (G.two) { G.two = null; G.q0.setFromRotationMatrix(c.g.matrix).invert(); G.o0.copy(c.o); G.p0.copy(GL.rig.localToWorld(XR.globeBase.clone().add(XR.globeOff))); G.reach = 1; G.r0.copy(XR.rot); }
  if (gp && gp.axes.length >= 4 && Math.abs(gp.axes[3]) > 0.2) G.reach = clamp(G.reach * Math.exp(gp.axes[3] * dt * 1.5), 0.15, 6);
  _gq.setFromRotationMatrix(c.g.matrix).multiply(G.q0);
  _gv.copy(G.p0).sub(G.o0).multiplyScalar(G.reach);
  const lenMax = 4;
  if (_gv.length() > lenMax) _gv.setLength(lenMax);
  _gv.applyQuaternion(_gq).add(c.o);
  GL.rig.worldToLocal(_gv);
  if (G.target === 'globe') {
    XR.globeOff.copy(_gv).sub(XR.globeBase);
    if (XR.free) XR.rot.copy(xrRigTurn(_gq, _gr)).multiply(G.r0);
  } else {
    XR.panelGroup.position.copy(_gv);
    if (XR.free) { XR.panelGroup.quaternion.copy(xrRigTurn(_gq, _gr)).multiply(G.r0); return; }   // held as it is: it may tilt
    GL.rig.worldToLocal(_gh.copy(XR.head));
    XR.panelGroup.rotation.set(0, Math.atan2(_gh.x - _gv.x, _gh.z - _gv.z), 0); // keep it upright, facing you
  }
}
// both hands on the scene: it grows and shrinks with the distance between them (a quarter to four times the
// story's own size) and moves with their middle; moving freely, the line between them turns it about their middle
function xrResize(a, b) {
  const d = a.o.distanceTo(b.o);
  _gv.copy(a.o).add(b.o).multiplyScalar(0.5);
  GL.rig.worldToLocal(_gv);
  _gh.copy(b.o).sub(a.o).applyQuaternion(_gr.copy(GL.rig.quaternion).invert()).normalize();   // (in the rig's frame)
  const T = a.grab.two || (a.grab.two = b.grab.two = { d0: Math.max(0.05, d), s0: XR.size, m0: _gv.clone(), off0: XR.globeOff.clone(), l0: _gh.clone(), r0: XR.rot.clone() });
  XR.size = clamp(T.s0 * d / T.d0, 0.25, 4);
  XR.globeOff.copy(T.off0).add(_gv).sub(T.m0);
  if (!XR.free) return;
  _gq.setFromUnitVectors(T.l0, _gh);
  XR.rot.copy(_gq).multiply(T.r0);
  XR.globeOff.copy(XR.globeBase).add(T.off0).sub(T.m0).applyQuaternion(_gq).add(_gv).sub(XR.globeBase);
}
function xrPoint(c, dt) {
  const g = c.g;
  if (!c.src || !g.visible) { c.hover = null; c.dot.visible = false; c.grab = null; return; }   // (a controller gone lets go)
  c.o.setFromMatrixPosition(g.matrix);
  c.d.set(0, 0, -1).transformDirection(g.matrix);
  let hit = null, dist = 2.5;
  // panels first: they are drawn on top of everything
  XR.raycaster.set(c.o, c.d);
  const hs = XR.raycaster.intersectObjects(XR.panelMeshes.filter(m => m.visible), false);
  // then the shared room's own things (its panel, the other stations, a calibration), if nearer than a panel
  const sh = HOST.collab.ray(c.i, c.o, c.d, hs.length ? hs[0].distance : Infinity);
  if (sh) { hit = sh; dist = sh.dist; }
  else if (xrAway()) hit = null;   // away from its station in a shared room: nothing of the story to point at
  else if (hs.length) {
    const h = hs[0], P = XR.panels.find(q => q.mesh === h.object);
    hit = { kind: 'panel', P, x: h.uv.x * P.w, y: (1 - h.uv.y) * P.h, point: h.point };
    dist = h.distance;
  } else if (!XR.stories) {
    const oL = _xa.copy(c.o).applyMatrix4(_xinv), dL = _xb.copy(c.d).transformDirection(_xinv);
    const b = oL.dot(dL), disc = b * b - (oL.lengthSq() - 1.0816);
    const t = disc > 0 ? -b - Math.sqrt(disc) : -1;
    const i = APP.mode === 'explore' ? pickCopyRay(oL, dL) : -1;
    if (t > 0 || i >= 0) {
      if (t > 0) _xp.copy(dL).multiplyScalar(t).add(oL);
      else nodePos(i, 0, _xp);
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
const _xUp = new THREE.Vector3(0, 1, 0);
function xrBegin(frame, dt) {
  xrSettings();
  const ref = GL.renderer.xr.getReferenceSpace();
  const pose = frame && ref ? frame.getViewerPose(ref) : null;
  if (pose) {
    const p = pose.transform.position, q = pose.transform.orientation;
    XR.head.set(p.x, p.y, p.z); XR.headQ.set(q.x, q.y, q.z, q.w);
    if (XR.needRecenter) { if (!HOST.anchor.held()) xrRecenter(); XR.needRecenter = false; } // an anchored place stays put
    // anchored: the spot in the room carries the frame that holds the panels, the Stories screen and the scene
    // (asked only once the headset has a pose, so a new anchor goes where things really are)
    const A = HOST.anchor.frame(frame, ref);
    if (A) { GL.rig.position.fromArray(A.p); GL.rig.quaternion.setFromAxisAngle(_xUp, A.yaw); }
    // in a shared room no Stories screen: a story is reached by walking into its station's circle, and at its station it
    // is the station's (a shell without HOST.room.away: only there); leaving the room brings it back, as for a new wearer
    const roomOnly = xrRoomOnly();
    if (XR.inRoom && !roomOnly) xrFreshStart();
    XR.inRoom = roomOnly;
    if (XR.stories && (roomOnly || (HOST.collab.mine() && HOST.room.placing()))) xrLandingClose();
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
  // away from its station in a shared room the story waits, silent (hidden in xrUpdate, not pointable in xrPoint); a
  // pause made here is not the room's (the shell takes no clock or state from a headset that is not at a station)
  if (xrAway()) { APP.playing = false; SLIDE.tail = null; }
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
  const land = !!XR.stories, away = xrAway();   // (away from its station in a shared room: the story hidden, only the shell's things)
  if (XR.land) {
    if (XR.landRev !== HOST.listRev) xrLandingCards();   // a story added while the app runs: its card joins the arc
    // Sound check takes the place of the story cards while it is open
    for (const P of XR.land) P.mesh.visible = land && (P === XR.land[0] || !XR.soundCheck);
    XR.snd.mesh.visible = land && !!XR.soundCheck;
    // labels hidden: no story panel at all, in story and explore mode (the Stories screen, the shell's menu and its
    // clock stay, and A or X still plays); labels in 3D: the panels stand in the scene, as the labels' signs do
    XR.main.mesh.visible = XR.foot.mesh.visible = !land && !away && XR.lm !== 'hidden';
    panelDepth(XR.main, XR.lm === 'fixed'); panelDepth(XR.foot, XR.lm === 'fixed');
  }
  GL.world.visible = !land && !away;
  if (land !== XR.landShown) { XR.landShown = land; HOST.setUrl(land); }
  GL.rig.updateMatrixWorld(true);
  XR.camLocal.copy(XR.head);
  GL.world.worldToLocal(XR.camLocal);
  // labels in 3D: each sign turns to you (placeLabelXR) from the world's frame back to the rig's, where your head is
  XR.signL.copy(GL.world.quaternion).invert();
  GL.rig.worldToLocal(XR.signH.copy(XR.head));
  const story = APP.mode === 'story';
  for (const L of ST.labels) {
    if (story) placeLabelXR(L, fadeVal(storyT(APP.t), L.tIn, L.tOut, 0.5), S);
    else hideLabelXR(L);
  }
  for (const L of LBL.extra) {
    if (!story) placeLabelXR(L, 1, S);
    else hideLabelXR(L);
  }
  xrTip(S);
  const now = performance.now();
  for (const P of XR.panels) panelTick(P, now);
}

// ---------------------------------------------------------- explore glue --
function xrClickCopy(c) {
  if (APP.mode !== 'explore') return;
  XR.kbd.open = false;
  if (X.tab === 'path') { xrSetPathEnd(NET.cProt[c]); return; }
  clickCopy(c);
}
// in the Paths tab, clicks in the cell fill the highlighted end (From, then To)
function xrSetPathEnd(p) {
  if (XR.pick === 'to') { XR.pt = p; $('#pt').value = NET.sym[p]; }
  else { XR.pf = p; $('#pf').value = NET.sym[p]; XR.pick = 'to'; }
  if (XR.pf >= 0 && XR.pt >= 0) runPath(XR.pf, XR.pt);
}
function xrPathPreset(s, t) {
  XR.pf = s; XR.pt = t; XR.pick = 'to';
  $('#pf').value = NET.sym[s]; $('#pt').value = NET.sym[t];
  runPath(s, t);
}
function xrClearPath() {
  X.path = null; X.pathErr = null; X.count = 0;
  setFocus(null); setHighlight('xpath', null);
  renderPathResult(); updateExtraLabels();
}
function xrPickSuggestion(p) {
  XR.kbd.open = false; XR.kbd.q = '';
  if (X.tab === 'path') xrSetPathEnd(p);
  else { $('#q').value = NET.sym[p]; showTab('protein'); selectProtein(p); }
}
function xrZoom(f) {
  const c = orbit.cur;
  orbit.from = c.slice();
  orbit.to = [c[0], c[1], clamp(c[2] * f, 0.9, 5), c[3], c[4]];
  orbit.t0 = performance.now();
}
function proteinInfo(p) {
  const k = p + '|' + scenNow().map(v => (v > 0.5 ? 1 : 0)).join('');
  if (XR.aiKey === k) return XR.ai;
  XR.aiKey = k; XR.ai = { reach: reachInfo(p), groups: partnersByPlace(p) };
  return XR.ai;
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
    session = await navigator.xr.requestSession(mode, { optionalFeatures: HOST.xr.features(mode) });
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
  XR.free = xrFreeOn(); XR.lm = xrLabelMode();   // (as the shell has them: nothing to turn off or on at the first frame)
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
  // (not in a shared room: there a story is reached by walking into its station's circle)
  XR.inRoom = xrRoomOnly();
  const fromStart = (HOST.picking || HOST.landingVR) && !XR.inRoom;
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
// wearer as a new visitor. Restart the story and place everything in front of them
// (when anchored, everything stays at its spot in the room).
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
  // in a shared room the story and its place stay (at its station the room's clock and state go on applying; away from
  // one a new wearer walks up to a station: no Stories screen in a room)
  if (HOST.collab.mine() || xrRoomOnly()) { lastNow = 0; return; }
  APP.enterStory(0); APP.playing = false; audioSync();
  XR.stories = true; XR.inStory = false; XR.soundCheck = false; // a new wearer lands in the Stories screen
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
    XR.globeOff.copy(p.off); XR.size = p.s || 1; xrSceneRot(p.rot || p.q);
    xrPanelPose(p.pp, p.pr, p.pq);
  }
  const ref = GL.renderer.xr.getReferenceSpace();
  if (ref && ref.addEventListener) ref.addEventListener('reset', () => { XR.needRecenter = true; });
}
function xrEnded() {
  if (!XR.on) return;
  const away = xrAway();   // (asked while the session is still the shell's)
  XR.on = false; XR.session = null; XR.mode = null; XR.hiddenAt = 0;
  HOST.session = null;
  document.body.classList.remove('xr');
  GL.rig.position.set(0, 0, 0); GL.rig.quaternion.identity();
  GL.world.position.set(0, 0, 0); GL.world.quaternion.identity(); GL.world.scale.setScalar(1);
  for (const P of XR.panels) P.mesh.visible = false;
  for (const c of XR.ctrls) { c.g.visible = false; c.dot.visible = false; c.press = null; c.grab = null; c.hover = null; c.src = null; }
  for (const L of [...ST.labels, ...LBL.extra]) { hideLabelXR(L); L.o = -1; }
  if (XR.tip) dropSprite(XR.tip);
  XR.tip = null; XR.tipI = -1;
  XR.clear = true;
  GL.stars.visible = true; GL.stars.material.size = 1.3;
  GL.U.uPx.value = 0;
  GL.world.visible = true;
  for (const P of XR.land || []) P.mesh.visible = false;
  if (XR.snd) XR.snd.mesh.visible = false;
  XR.soundCheck = false;
  // left the headset from the Stories screen, or away from a station in a shared room (its story hidden and paused
  // there): back to the Stories screen on the page
  if (XR.stories || away) { XR.stories = false; HOST.openPicker(); }
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
  magenta: '#ff5ad9', teal: '#38e6c7', amber: '#ffb43b', red: '#ff5a4b', green: '#3ee08f' };
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
// a title (textBaseline top): its own size when it fits, else smaller to fit, down to min, on the same baseline;
// below that, with two, on two lines split where they are most even (as large as fits); else cut short at min.
// Returns its height: lh for one line, lh plus a line for two.
function fitTitle(ctx, text, x, y, maxW, px, lh, color, weight, min, two) {
  text = String(text); ctx.fillStyle = color || VC.ink;
  const size = L => {   // the largest size from px down to min at which every line fits, else 0
    ctx.font = vfont(px, weight);
    let s = Math.min(px, Math.floor(px * maxW / Math.max(...L.map(l => ctx.measureText(l).width))));
    for (; s >= min; s--) { ctx.font = vfont(s, weight); if (L.every(l => ctx.measureText(l).width <= maxW)) return s; }
    return 0;
  };
  let s = size([text]);
  if (!s && two) {
    const wd = text.split(' ');
    let L = null, m = Infinity;
    ctx.font = vfont(px, weight);
    for (let k = 1; k < wd.length; k++) {
      const p = [wd.slice(0, k).join(' '), wd.slice(k).join(' ')], v = Math.max(...p.map(l => ctx.measureText(l).width));
      if (v < m) { m = v; L = p; }
    }
    if (L && (s = size(L))) {
      const y0 = y + Math.round((px - s) * 0.8), l2 = Math.round(lh * s / px);
      L.forEach((l, k) => ctx.fillText(l, x, y0 + k * l2));
      return lh + l2;
    }
  }
  s = s || min; ctx.font = vfont(s, weight);
  ctx.fillText(fitText(ctx, text, maxW), x, y + Math.round((px - s) * 0.8));   // (B612's baseline is 0.8 of its size down)
  return lh;
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
  const P = { w, h, cv, ctx: cv.getContext('2d'), tex, mesh, draw, sig, regions: [], hover: null, last: '', t: 0, inScene: false };
  P.at = (x, y) => {
    for (let k = P.regions.length - 1; k >= 0; k--) {
      const r = P.regions[k];
      if (x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h) return r;
    }
    return null;
  };
  return P;
}
// a story panel in the scene or on top, as the labels are: labels in 3D, it stands in the scene as their signs do
// (depth-tested and writing depth, drawn first of the see-through things, its clear corners cut away), so what stands
// in front of it hides it and it hides what is behind it; otherwise it is drawn over everything. Set only when that
// changes (a new alphaTest needs the material built again)
function panelDepth(P, inScene) {
  if (P.inScene === inScene) return;
  const m = P.mesh.material;
  P.inScene = m.depthTest = m.depthWrite = inScene;
  m.alphaTest = inScene ? 0.1 : 0; m.needsUpdate = true;
  P.mesh.renderOrder = inScene ? -1 : 50;
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
    let s = 's' + audioLabel() + xrSig() + (HOST.room && HOST.room.inRoom() ? 'r' + HOST.room.gripHint : '') + (curCh ? curCh.key : '');
    if (it) {
      for (const e of it.els) s += Math.round(Math.max(0, e.o) * 3);
      for (const g of it.grow) s += Math.round(Math.max(0, g.s) * 6);
      if (curCh.key === 'title') s += $('#titleArc').getAttribute('stroke-dashoffset').slice(0, 3) + $('#titleDot').getAttribute('opacity').slice(0, 3);
      if (curCh.key === 'signal') s += $('#steps').textContent;
    }
    return s;
  }
  return ['x', audioLabel(), xrSig(), X.tab, X.sel, X.selCopy, X.path ? X.path.join(',') : '', X.pathErr || '', X.color, X.cell, X.iso, X.scen.join(''),
    scenNow().map(v => Math.round(v * 4)).join(''), X.bait, X.proxR, XR.kbd.open, XR.kbd.q, XR.pf, XR.pt, XR.pick].join('|');
}
const XR_HERE = 'spatial';
const XR_STORIES = HOST.list;
// ------------------------------------------------------- headset landing --
// The Stories screen in the headset: a title panel and one card per story,
// floating in an arc in front of you while the story itself is hidden.
function xrLandingSetup() {
  XR.land = [];
  XR.landGroup = new THREE.Group();
  GL.rig.add(XR.landGroup);
  const head = makePanel(1400, 300, 1.02, drawLandHead, () => 'h' + XR.inStory + audioLabel() + HOST.repeat + XR.soundCheck + HOST.audio.muted + HOST.anchor.status() + HOST.list.length);
  head.mesh.position.set(0, 0.36, -1.22);
  XR.landGroup.add(head.mesh); XR.land.push(head); XR.panels.push(head);
  xrLandingCards();
  // Sound check (opened from the header), in the place of the story cards
  XR.snd = makePanel(1400, 860, 1.02, drawSoundCheck, () => (XR.snd.mesh.visible ? 'snd' + Math.floor(performance.now() / 500) : 'off'));
  XR.snd.mesh.position.set(0, -0.17, -1.2);
  XR.landGroup.add(XR.snd.mesh); XR.panels.push(XR.snd);
  XR.panelMeshes = XR.panels.map(P => P.mesh);
}
// One card per story, 0.36 m wide, on an arc for any number of stories: neighbours 0.381 m apart and the outer ones at
// most 62° to the side (fifteen: 0.155 rad apart at 2.46 m), never nearer than 1.25 m (a few stories stand closer
// together in angle). Built again when the shell's list of stories changes while the app runs (HOST.listRev: a story
// added in a release gets its card)
function xrLandingCards() {
  for (const P of XR.land.splice(1)) {
    XR.landGroup.remove(P.mesh); XR.panels.splice(XR.panels.indexOf(P), 1);
    P.tex.dispose(); P.mesh.geometry.dispose(); P.mesh.material.dispose();
  }
  const n = HOST.list.length, d = Math.max(1.25, n > 1 ? 0.1905 / Math.sin(1.085 / (n - 1)) : 0), step = 2 * Math.asin(0.1905 / d);
  XR.landRev = HOST.listRev;
  HOST.list.forEach((s, k) => {
    const a = (k - (n - 1) / 2) * step;
    const P = makePanel(640, 820, 0.36, (ctx, P) => drawLandCard(ctx, P, s), () => 'c' + XR.inStory + s.key);
    P.mesh.position.set(Math.sin(a) * d, -0.105, -Math.cos(a) * d);   // top edge 0.126 m up, under the header
    P.mesh.rotation.y = -a;
    XR.landGroup.add(P.mesh); XR.land.push(P); XR.panels.push(P);
  });
  XR.panelMeshes = XR.panels.map(P => P.mesh);
}
// leave the Stories screen: back into this story (resumed, or started if it never ran)
function xrLandingClose() {
  XR.stories = false;
  // at a shared room's station the story goes on as the room has it: a restart here would restart it for everyone (in
  // a room a story runs only at its station, on the station's clock)
  if (!XR.inStory && !HOST.collab.mine() && !xrRoomOnly()) APP.enterStory(0);
  XR.inStory = true;
  if (APP.mode === 'story' && !xrRoomOnly()) APP.playing = true;
}
function drawLandHead(ctx, P) {
  ctx.font = vfont(58, 700); ctx.fillStyle = VC.ink; ctx.fillText(`Networks, in ${['one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen',
    'sixteen', 'seventeen', 'eighteen', 'nineteen', 'twenty'][HOST.list.length - 1] || HOST.list.length} stories`, 48, 44);
  // anchored: where the place stands, in place of the hint
  const an = HOST.anchor.status();
  textBlock(ctx, an || 'The same ideas, very different networks. Point at a story and pull the trigger (or pinch).', 48, 128, 860, 27, 38, an ? VC.ink : VC.muted, 400, 2);
  // the sound, before a story starts: its state (press to start it, or to turn the narration off and on) and Sound check
  const sl = audioLabel() || (HOST.audio.muted ? 'Sound off' : 'Sound');
  vButton(ctx, P, 'land:sound', 48, 212, 300, 64, sl, () => audioToggle(), { on: sl === 'Sound on', px: 25 });
  vButton(ctx, P, 'land:check', 362, 212, 250, 64, 'Sound check', () => { XR.soundCheck = !XR.soundCheck; }, { on: !!XR.soundCheck, px: 25 });
  // Anchor: keep the scenes and panels at this spot in the room, for every story (pressing it lit turns it off)
  vButton(ctx, P, 'land:anchor', 626, 212, 200, 64, 'Anchor', () => HOST.anchor.set(!HOST.anchor.on), { on: HOST.anchor.on, px: 25 });
  let x = P.w - 44;
  const hb = (id, label, fn, w, o) => { x -= w; vButton(ctx, P, id, x, 40, w, 64, label, fn, o); x -= 14; };
  hb('exit', 'Exit', () => { if (XR.session) XR.session.end(); }, 110, { px: 27 });
  // anchored, Recenter becomes Place again: everything in front of you, then anchored there
  if (HOST.anchor.on) hb('again', 'Place again', () => { HOST.anchor.again(); XR.needRecenter = true; }, 210, { px: 27 });
  else hb('recenter', 'Recenter', () => { XR.needRecenter = true; }, 170, { px: 27 });
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
  fitTitle(ctx, s.kick.toUpperCase(), 48, 64, P.w - 96, 28, 34, s.col, 700, 22);
  // a long title shrinks a little, else takes two lines and the description moves down (ending above the length)
  const dy = 112 + fitTitle(ctx, s.title, 46, 112, P.w - 94, 72, 78, VC.ink, 700, 58, true) + 32;
  textBlock(ctx, s.desc, 48, dy, P.w - 96, 31, 45, VC.muted, 400, Math.min(7, Math.floor((P.h - 243 - dy) / 45) + 1));
  ctx.font = vfont(26); ctx.fillStyle = VC.faint; ctx.fillText(fitText(ctx, s.len, P.w - 96), 48, P.h - 196);
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
    let yw = 0;   // the kicker stops short of 'You are here' beside it
    if (here) { ctx.font = vfont(22); ctx.fillStyle = VC.cyan; ctx.textAlign = 'right'; ctx.fillText('You are here', x + W - 26, y + 26); ctx.textAlign = 'left'; yw = ctx.measureText('You are here').width + 20; }
    fitTitle(ctx, kick.toUpperCase(), x + 26, y + 22, W - 52 - yw, 21, 26, col, 700, 17);
    fitTitle(ctx, title, x + 26, y + 54, W - 52, 38, 44, VC.ink, 700, 30);
    textBlock(ctx, desc, x + 26, y + 100, W - 52, 24, 33, VC.muted, 400, 2);
    y += h + 18;
  }
  vButton(ctx, P, 'story:close', x, y + 4, 220, 60, 'Back', () => { XR.stories = false; }, { px: 25 });
}
function drawMain(ctx, P) {
  const story = APP.mode === 'story';
  let x = P.w - 36;
  const hb = (id, label, fn, w, o) => { x -= w; vButton(ctx, P, id, x, 26, w, 54, label, fn, o); x -= 12; };
  // (Exit is on the shell's Shared panel, at hand on the left controller)
  if (AUD && AUD.state !== 'none') hb('sound', audioLabel(), () => audioToggle(), 180, { on: AUD.on(), px: 23 });
  if (!HOST.anchor.on) hb('recenter', 'Recenter', () => { XR.needRecenter = true; }, 140); // anchored: nothing moves
  // in a shared room no Stories button: each station keeps its story, and another story is another station (walk into
  // its circle)
  if (!(HOST.room && HOST.room.placing()) && !xrRoomOnly()) hb('stories', 'Stories', () => { XR.stories = true; XR.kbd.open = false; APP.playing = false; }, 130);
  if (!XR.stories) hb('mode', story ? 'Explore now' : 'Replay story', () => (story ? APP.enterExplore() : APP.enterStory(0)), 186, { primary: story });
  // the story's name, smaller when the buttons leave it less room
  fitTitle(ctx, 'Spatial interactome', 40, 36, x - 40, 30, 36, VC.ink, 700, 24);
  ctx.fillStyle = VC.line; ctx.fillRect(36, 104, P.w - 72, 2);
  if (XR.stories) drawStoriesPane(ctx, P, 44, 136, P.w - 88);
  else if (story) {
    drawStoryPane(ctx, P, 44, 136, P.w - 88);
    ctx.fillStyle = VC.line; ctx.fillRect(36, P.h - 96, P.w - 72, 2);
    textBlock(ctx, HOST.room && HOST.room.inRoom() ? HOST.room.gripHint : HOST.anchor.on ? 'Trigger (or pinch): use buttons. A or X: play and pause. Anchored: to move things, use Place again on the Stories screen.' : XR.free ? 'Trigger (or pinch): use buttons. Grip: hold the cell or this panel to move and turn it; both grips on the cell resize it. A or X: play and pause.' : 'Trigger (or pinch): use buttons. Grip: move the cell or this panel; both grips on the cell resize it. A or X: play and pause.', 44, P.h - 74, P.w - 88, 22, 30, VC.faint);
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
    ctx.strokeStyle = VC.teal; ctx.lineWidth = 3.3; ctx.lineCap = 'round';
    if (prog > 0.002) {
      ctx.beginPath(); ctx.moveTo(p0[0], p0[1]);
      for (let n = 1; n <= 48; n++) { const s = prog * n / 48; ctx.lineTo(bz(s, 0), bz(s, 1)); }
      ctx.stroke();
    }
    ctx.fillStyle = VC.teal;
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
      const col = ['amber', 'magenta', 'teal', 'green', 'red', 'cyan'].find(c => cl.contains(c));
      h = textBlock(ctx, el.textContent, x, y, W, s.px, s.lh, col ? VC[col] : VC[s.c], s.w) + s.mb;
    }
  } else if (cl.contains('big')) {
    const col = ['magenta', 'teal', 'cyan', 'green', 'amber', 'red'].find(c => cl.contains(c));
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
function drawExplorePane(ctx, P, x, y, W) {
  const tw = W / TABS.length;
  TABS.forEach(([k, n], j) => {
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
  if (XR.kbd.open && (X.tab === 'protein' || X.tab === 'path')) return drawKeyboard(ctx, P, x, y, W);
  if (X.tab === 'protein') drawProteinPane(ctx, P, x, y, W, bottom);
  else if (X.tab === 'path') drawPathPane(ctx, P, x, y, W, bottom);
  else if (X.tab === 'places') drawPlacesPane(ctx, P, x, y, W);
  else if (X.tab === 'moves') drawMovesPane(ctx, P, x, y, W, bottom);
  else if (X.tab === 'prox') drawProxPane(ctx, P, x, y, W, bottom);
}
function searchField(ctx, P, x, y, W, text) {
  vButton(ctx, P, 'search', x, y, W, 66, '', () => { XR.kbd.open = true; XR.kbd.q = ''; }, { r: 10 });
  ctx.strokeStyle = VC.muted; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.arc(x + 32, y + 30, 11, 0, 7); ctx.moveTo(x + 40, y + 38); ctx.lineTo(x + 49, y + 47); ctx.stroke();
  ctx.font = vfont(25); ctx.fillStyle = VC.faint; ctx.fillText(text, x + 66, y + 20);
}
function chipFlow(ctx, P, items, x, y, W, maxY, label, fn, idp, colorOf) {
  let cx = x, cy = y, shown = 0;
  ctx.font = vfont(23);
  for (const it of items) {
    const t = label(it), col = colorOf ? colorOf(it) : null, sw = col ? 22 : 0, w = ctx.measureText(t).width + 26 + sw;
    if (cx + w > x + W) { cx = x; cy += 50; }
    if (cy + 42 > maxY) break;
    vButton(ctx, P, idp + it, cx, cy, w, 42, '', () => fn(it), { r: 6 });
    if (col) swatch(ctx, cx + 12, cy + 14, 14, col);
    ctx.font = vfont(23); ctx.fillStyle = VC.ink; ctx.textBaseline = 'middle';
    ctx.fillText(t, cx + 13 + sw, cy + 22); ctx.textBaseline = 'top';
    cx += w + 8; shown++;
  }
  return { h: cy - y + 42, shown };
}
function drawProteinPane(ctx, P, x, y, W, bottom) {
  searchField(ctx, P, x, y, W, 'Search a protein');
  y += 92;
  const i = X.sel, { sym, name, role, pCopies, pDeg } = NET;
  if (i < 0) {
    y += textBlock(ctx, 'Point at any protein in the cell and pull the trigger (or pinch) to see where it works and whom it meets there. Drag the cell to turn it, push the thumbstick to spin and zoom, hold the grip to move it (both grips: resize it).', x, y, W, 28, 41, VC.muted) + 22;
    chipFlow(ctx, P, QUICK, x, y, W, bottom, c => `${c} ${NET.name[A(c)]}`, c => selectProtein(A(c)), 'quick:');
    return;
  }
  const info = proteinInfo(i);
  y += textBlock(ctx, `${sym[i]} ${name[i]}`, x, y, W, 38, 46, VC.ink, 700, 2) + 4;
  y += textBlock(ctx, role[i], x, y, W, 25, 34, VC.muted, 400, 1) + 18;
  ctx.font = vfont(23); ctx.fillStyle = VC.muted; ctx.fillText('Found in', x, y + 3);
  pCopies[i].forEach((c, k) => {
    const yy = y + k * 40;
    swatch(ctx, x + 190, yy + 6, 22, placeCss(NET.cPlace[c]));
    ctx.font = vfont(27); ctx.fillStyle = isThere(c) ? VC.ink : VC.faint;
    ctx.fillText(placeName(NET.cPlace[c]) + (isThere(c) ? '' : ' (not now)'), x + 224, yy);
  });
  y += pCopies[i].length * 40 + 10;
  ctx.font = vfont(23); ctx.fillStyle = VC.muted; ctx.fillText('Partners', x, y + 3);
  ctx.font = vfont(27); ctx.fillStyle = VC.ink; ctx.fillText(String(pDeg[i]), x + 190, y);
  y += 44;
  ctx.font = vfont(23); ctx.fillStyle = VC.muted; ctx.fillText('Reach', x, y + 3);
  const r = info.reach;
  y += textBlock(ctx, r.n ? `${r.avg.toFixed(2)} steps on average to ${fmt(r.n)} proteins, farthest ${sym[r.far]}` : 'No connections right now', x + 190, y, W - 190, 25, 34, VC.ink, 400, 2) + 16;
  vButton(ctx, P, 'apath', x, y, 330, 60, 'Find a path from here', () => {
    xrClearPath();
    XR.pf = i; XR.pt = -1; XR.pick = 'to';
    $('#pf').value = sym[i]; $('#pt').value = '';
    showTab('path');
  });
  vButton(ctx, P, 'aprox', x + 342, y, 330, 60, 'Tag its neighbours', () => { setBait(X.selCopy >= 0 ? X.selCopy : pCopies[i][0]); showTab('prox'); });
  y += 80;
  for (const [pl, l] of info.groups) {
    if (y + 90 > bottom) break;
    swatch(ctx, x, y + 4, 18, placeCss(pl));
    ctx.font = vfont(22); ctx.fillStyle = VC.muted; ctx.fillText(`${l.length} in the ${placeShort(pl)}`, x + 28, y);
    y += 34;
    const rr2 = chipFlow(ctx, P, l.map((o, k) => k), x, y, W, bottom, k => sym[l[k].p], k => selectProtein(l[k].p), 'nb:' + pl + ':',
      k => (l[k].across >= 0 ? placeCss(l[k].across) : null));
    y += rr2.h + 14;
  }
}
function drawPathPane(ctx, P, x, y, W, bottom) {
  const { sym } = NET;
  y += textBlock(ctx, 'Shortest paths', x, y, W, 38, 46, VC.ink, 700) + 6;
  y += textBlock(ctx, 'Fewest steps between two proteins. A step is a binding, or a move from one place to another.', x, y, W, 24, 34, VC.muted) + 18;
  const bw = (W - 16) / 2;
  [['from', 'From', XR.pf], ['to', 'To', XR.pt]].forEach(([k, lab, i], j) => {
    const bx = x + j * (bw + 16), on = XR.pick === k;
    vButton(ctx, P, 'end:' + k, bx, y, bw, 98, '', () => { XR.pick = k; }, { on });
    ctx.font = vfont(21); ctx.fillStyle = on ? VC.cyan : VC.muted; ctx.fillText(on ? lab + ' (pick in the cell)' : lab, bx + 16, y + 14);
    ctx.font = vfont(28, 700); ctx.fillStyle = i >= 0 ? VC.ink : VC.faint;
    ctx.fillText(fitText(ctx, i >= 0 ? `${sym[i]}  ${NET.name[i]}` : '—', bw - 32), bx + 16, y + 50);
  });
  y += 116;
  const btns = [['psearch', 'Search', () => { XR.kbd.open = true; XR.kbd.q = ''; }, 130],
    ...PATH_PRESETS.map(([s, t, n], k) => ['pre' + k, n, () => xrPathPreset(A(s), A(t)), Math.max(150, 16 * n.length + 30)]),
    ['prand', 'Random', () => xrPathPreset(Math.floor(Math.random() * NET.P), Math.floor(Math.random() * NET.P)), 140]];
  let bx = x, by = y;
  for (const [id, lab, fn, w] of btns) {
    if (bx + w > x + W) { bx = x; by += 68; }
    vButton(ctx, P, id, bx, by, w, 58, lab, fn, { px: 23 }); bx += w + 10;
  }
  y = by + 84;
  if (X.pathErr) { textBlock(ctx, X.pathErr, x, y, W, 26, 38, VC.muted); return; }
  if (!X.path) { textBlock(ctx, 'Point at two proteins in the cell, or try one of the examples.', x, y, W, 26, 38, VC.muted); return; }
  const p = X.path, L = p.length - 1, steps = pathSteps(p), moves = steps.filter(s => s.move).length;
  ctx.font = vfont(64, 700); ctx.fillStyle = VC.teal;
  ctx.fillText(`${L} ${L === 1 ? 'step' : 'steps'}`, x, y);
  y += 82;
  y += textBlock(ctx, `${moves ? `${moves} of them ${moves === 1 ? 'a move' : 'moves'} between places. ` : ''}${X.count > 1 ? `One of ${fmt(X.count)} equally short paths.` : 'The only path this short.'}`, x, y, W, 23, 33, VC.muted) + 14;
  const strip = s => s.replace(/<[^>]+>/g, '');
  for (let k = 0; k < L; k++) {
    if (y + 50 > bottom - (k < L - 1 ? 40 : 0)) {
      ctx.font = vfont(21); ctx.fillStyle = VC.muted;
      ctx.fillText(`and ${L - k} more ${L - k === 1 ? 'step' : 'steps'}`, x + 44, y + 10);
      break;
    }
    const st = steps[k];
    ctx.fillStyle = VC.line; ctx.fillRect(x, y, W, 2);
    ctx.font = vfont(24, 700); ctx.fillStyle = st.move ? VC.amber : VC.teal; ctx.fillText(String(k + 1), x, y + 12);
    ctx.fillStyle = VC.ink; ctx.fillText(fitText(ctx, strip(st.text), 380), x + 44, y + 12);
    ctx.font = vfont(21); ctx.fillStyle = VC.muted;
    ctx.fillText(fitText(ctx, st.sub, W - 450), x + 440, y + 15);
    y += 52;
  }
}
function drawPlacesPane(ctx, P, x, y, W) {
  const s = placeCounts();
  y += textBlock(ctx, 'Places', x, y, W, 38, 46, VC.ink, 700) + 6;
  y += textBlock(ctx, 'The compartments of the model cell. Select one to isolate it.', x, y, W, 24, 34, VC.muted) + 12;
  PLACES.forEach((pl, k) => {
    const id = 'pl:' + k, on = X.iso === k, hov = P.hover === id;
    if (on || hov) { rr(ctx, x - 8, y, W + 16, 62, 8); ctx.fillStyle = on ? VC.on : VC.chip; ctx.fill(); }
    swatch(ctx, x + 2, y + 10, 22, placeCss(k));
    ctx.font = vfont(25); ctx.fillStyle = VC.ink; ctx.fillText(pl[1], x + 38, y + 6);
    ctx.font = vfont(21); ctx.fillStyle = VC.muted; ctx.textAlign = 'right';
    ctx.fillText(`${fmt(s[k].n)} proteins`, x + W, y + 9); ctx.textAlign = 'left';
    ctx.fillStyle = VC.faint;
    ctx.fillText(`${s[k].inside} interactions inside, ${s[k].across} across its boundary`, x + 38, y + 35);
    P.regions.push({ id, x, y, w: W, h: 62, fn: () => { const li = document.querySelector(`#pane-places [data-k="${k}"]`); if (li) li.click(); } });
    y += 64;
  });
}
function drawMovesPane(ctx, P, x, y, W, bottom) {
  y += textBlock(ctx, 'Moves', x, y, W, 38, 46, VC.ink, 700) + 6;
  y += textBlock(ctx, 'Proteins change place after a signal, and in disease. Start a move and watch the network rewire.', x, y, W, 24, 34, VC.muted) + 14;
  const open = MOVES.findIndex((m, k) => X.scen[k]);
  MOVES.forEach((m, k) => {
    const on = !!X.scen[k];
    ctx.fillStyle = VC.line; ctx.fillRect(x, y, W, 2);
    y += 12;
    ctx.font = vfont(27, 700); ctx.fillStyle = VC.ink; ctx.fillText(m.name, x, y);
    if (m.disease) { const w = ctx.measureText(m.name).width; ctx.font = vfont(18, 700); ctx.fillStyle = VC.red; ctx.fillText('DISEASE', x + w + 14, y + 7); }
    ctx.font = vfont(22); ctx.fillStyle = VC.muted; ctx.fillText(m.title, x, y + 36);
    vButton(ctx, P, 'mv:' + k, x + W - 150, y + 2, 150, 56, on ? 'Undo' : m.disease ? 'Show' : 'Start', () => {
      setMove(k, !X.scen[k]);
      if (X.scen[k]) { const cs = [...m.travelers.flat(), ...m.fails.flat(), ...m.cueCopies]; const cen = cs.reduce((a, c) => v3.add(a, cpos(c)), [0, 0, 0]), [la, lo] = latLonOf(cen); flyTo(la, lo, 2.3); }
    }, { on, px: 23 });
    y += 72;
    if (on && k === open) {
      y += textBlock(ctx, m.text, x, y, W, 22, 31, VC.muted, 400, 5) + 6;
      for (const d of moveDelta(m)) {
        const t = `${NET.sym[d.p]}${d.lost.length ? ' loses ' + d.lost.map(q => NET.sym[q]).join(', ') : ''}${d.gained.length ? (d.lost.length ? ', gains ' : ' gains ') + d.gained.map(q => NET.sym[q]).join(', ') : ''}`;
        y += textBlock(ctx, t, x, y, W, 22, 31, VC.ink, 400, 2) + 4;
      }
      y += 8;
    }
  });
  if (y + 60 < bottom) vButton(ctx, P, 'mvreset', x, y + 6, 330, 56, 'Back to a resting cell', () => MOVES.forEach((_, k) => setMove(k, false)), { px: 23 });
}
function drawProxPane(ctx, P, x, y, W, bottom) {
  y += textBlock(ctx, 'Proximity labelling', x, y, W, 38, 46, VC.ink, 700) + 6;
  y += textBlock(ctx, 'An enzyme fused to a bait protein tags every protein nearby. Pick a bait in the cell or below.', x, y, W, 24, 34, VC.muted) + 14;
  const r = chipFlow(ctx, P, PROX_PRESETS, x, y, W, bottom, s => `${s} ${placeShort(NET.cPlace[CP(s)])}`, s => setBait(CP(s)), 'px:');
  y += r.h + 22;
  ctx.font = vfont(23); ctx.fillStyle = VC.muted; ctx.fillText('Labelling radius', x, y);
  y += 36;
  const sw = W - 2 * 92, sx = x + 92, frac = (X.proxR - 0.03) / 0.13;
  const setR = v => { X.proxR = clamp(Math.round(v * 200) / 200, 0.03, 0.16); $('#pxr').value = X.proxR; renderProx(); };
  vButton(ctx, P, 'pr-', x, y, 76, 56, '−', () => setR(X.proxR - 0.01), { px: 28 });
  vButton(ctx, P, 'pr+', sx + sw + 16, y, 76, 56, '+', () => setR(X.proxR + 0.01), { px: 28 });
  rr(ctx, sx, y + 25, sw, 6, 3); ctx.fillStyle = 'rgba(160,178,202,0.3)'; ctx.fill();
  rr(ctx, sx, y + 25, sw * frac, 6, 3); ctx.fillStyle = VC.green; ctx.fill();
  ctx.beginPath(); ctx.arc(sx + sw * frac, y + 28, P.hover === 'pxslider' ? 17 : 14, 0, 7); ctx.fillStyle = VC.green; ctx.fill();
  P.regions.push({ id: 'pxslider', x: sx - 16, y, w: sw + 32, h: 56, drag: px => setR(0.03 + 0.13 * (px - sx) / sw) });
  y += 84;
  if (X.bait < 0) { textBlock(ctx, 'No bait yet.', x, y, W, 26, 38, VC.muted); return; }
  const t = proxTagged(), part = t.filter(o => o.partner).length, b = X.bait;
  ctx.font = vfont(68, 700); ctx.fillStyle = VC.green; ctx.fillText(String(t.length), x, y);
  y += 80;
  const how = !t.length ? 'Make the radius larger.' : part === t.length ? (part === 1 ? 'It binds the bait directly (teal).' : 'All of them bind it directly (teal).') : part ? `${part} of them bind it directly (teal); the others are neighbours.` : 'None of them binds it directly: they are neighbours.';
  y += textBlock(ctx, `proteins tagged around ${NET.sym[NET.cProt[b]]} in the ${placeShort(NET.cPlace[b])}. ${how}`, x, y, W, 23, 33, VC.muted) + 12;
  chipFlow(ctx, P, t.map(o => o.c), x, y, W, bottom, c => NET.sym[NET.cProt[c]], c => selectProtein(NET.cProt[c], false, c), 'pt:',
    c => (NET.partners[NET.cProt[b]].has(NET.cProt[c]) ? VC.teal : placeCss(NET.cPlace[c])));
}
// on-panel keyboard for searching proteins
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
  else if (!kb.q) textBlock(ctx, 'Tip: type two symbols with TO between them, like EGF TO SRF, to find a path.', x, y, W, 24, 34, VC.faint);
  sug.forEach((i, k) => {
    const id = 'sug:' + i, yy = y + k * 60;
    vButton(ctx, P, id, x, yy, W, 54, '', () => xrPickSuggestion(i), { r: 8 });
    ctx.font = vfont(25, 700); ctx.fillStyle = VC.ink; ctx.fillText(NET.sym[i], x + 16, yy + 14);
    ctx.font = vfont(23); ctx.fillStyle = VC.muted; ctx.fillText(fitText(ctx, `${NET.name[i]}, ${NET.role[i]}`, W - 360), x + 136, yy + 15);
    ctx.fillStyle = VC.faint; ctx.textAlign = 'right'; ctx.fillText(fitText(ctx, wherePlaces(i), 200), x + W - 16, yy + 15); ctx.textAlign = 'left';
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
  vButton(ctx, P, 'key:done', x + 614, by, 290, kh, route ? 'Find path' : sug.length ? 'Choose ' + NET.sym[sug[0]] : 'Close', () => {
    if (route) {
      kb.open = false; runQuery(kb.q.trim()); kb.q = '';
      if (X.pathEnds) { XR.pf = X.pathEnds[0]; XR.pt = X.pathEnds[1]; XR.pick = 'to'; }
    } else if (sug.length) xrPickSuggestion(sug[0]); else kb.open = false;
  }, { px: 24, primary: route || !!sug.length });
}

// ----------------------------------------------------------- footer panel --
function sigFoot() {
  return APP.mode === 'story' ? 's' + Math.round(APP.t * 4) + APP.playing + (curCh ? curCh.key : '') + slideSig()
    : 'x' + X.color + X.cell + X.routes.toFixed(2);
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
    ctx.font = vfont(22); ctx.fillStyle = VC.muted; ctx.textAlign = 'right'; ctx.fillText(m(t) + ' / ' + m(T_END), x1, 44); ctx.textAlign = 'left';
    // this story's Slideshow switch, left of the clock (placed for the longest clock, so it never shifts)
    const sx = x1 - ctx.measureText(m(T_END) + ' / ' + m(T_END)).width - 220;
    if (HOST.slides) vButton(ctx, P, 'slides', sx, 26, 198, 42, 'Slideshow: ' + (slidesOn() ? 'on' : 'off'), slideToggle, { on: slidesOn(), px: 20 });
    // slideshow: waiting at the end of a chapter, Next in the place of the chapter's name (the panel above has it)
    if (SLIDE.at >= 0) vButton(ctx, P, 'slideNext', x0, 16, 180, 48, 'Next', slideNext, { primary: true, px: 28 });
    else { ctx.font = vfont(27, 700); ctx.fillStyle = VC.ink; ctx.fillText(fitText(ctx, CH[ci].name, (HOST.slides ? sx : x1 - 160) - 16 - x0), x0, 40); }
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
  seg(22, 'Color', 'color', [['place', 'Place', 110], ['multi', 'Addresses', 150], ['deg', 'Partners', 124], ['plain', 'Plain', 100]]);
  let x = seg(96, 'Cell', 'cell', [['on', 'On', 80], ['faint', 'Faint', 100], ['off', 'Off', 80]]) + 22;
  ctx.font = vfont(22); ctx.fillStyle = VC.muted; ctx.fillText('Lines', x, 114); x += 64;
  const setRoutes = v => { X.routes = clamp(Math.round(v * 20) / 20, 0, 1.6); $('#rta').value = X.routes; };
  vButton(ctx, P, 'rt-', x, 96, 56, 56, '−', () => setRoutes(X.routes - 0.15), { px: 28 });
  vButton(ctx, P, 'rt+', x + 62, 96, 56, 56, '+', () => setRoutes(X.routes + 0.15), { px: 28 }); x += 140;
  ctx.font = vfont(22); ctx.fillStyle = VC.muted; ctx.fillText('Zoom', x, 114); x += 66;
  vButton(ctx, P, 'z-', x, 96, 56, 56, '−', () => xrZoom(1.3), { px: 28 });
  vButton(ctx, P, 'z+', x + 62, 96, 56, 56, '+', () => xrZoom(1 / 1.3), { px: 28 });
}


// ------------------------------------------------------------- narration --
// Optional voice-over: put an MP3 at audio/narration-spatial.mp3.
// Second 0 of the recording plays at second 0 of the story; the story clock
// follows the audio, so seeking, pausing and chapter jumps stay in sync.
// Without the file the story runs silently. The sound engine is the shell's
// (HOST.audio): one engine for the whole app, unlocked by the first tap or click
// and kept running across stories and headset sessions.
let AUD = null;
function audioInit() {
  AUD = HOST.audio.narration('audio/narration-spatial.mp3', {
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
// the narration plays while the story plays (at a slideshow stop, a voice may finish its chapter: slideSound)
function audioSync() { if (AUD) AUD.sync(...slideSound()); }
// while it plays, the narration is the clock: the story follows it
function audioFollow() { if (AUD && !SLIDE.tail) APP.t = AUD.follow(APP.t); }
function audioLabel() { return AUD ? AUD.label() : ''; }
function audioToggle() { HOST.audio.toggle(); }

// ------------------------------------------------------------- slideshow --
// Slideshow (HOST.slides: on for this story, or for all): the story waits at the end of each chapter, all its text
// shown, until Next (or Play) goes on. The stop is a pause and a seek, Next a play, so in a shared room they reach
// the station's clock like a pause and a play by hand, at the same t on every device.
const SLIDE = { at: -1, go: -1, last: 0, lt: 0, lp: false, tail: null };
const slidesOn = () => !!(HOST.slides && HOST.slides.on(XR_HERE));
// where chapter i waits: just before its text starts to fade out (0.65 s before its end in story time), on the
// recording's clock; the same on every device
const slideStop = i => narrT(CH[i].b - 0.7);
// a chapter's last words can run on past that point (the airports' by up to 2.4 s): a story with a recording says
// where each chapter's voice ends in it (NARRATION_ENDS, seconds by chapter key), and the voice finishes there while
// the story waits (slideSound); a story without one pauses the narration with the clock
const slideVoice = i => (typeof NARRATION_ENDS === 'object' && +NARRATION_ENDS[CH[i].key]) || 0;
// every frame, once the clock has moved on from t0: crossing a stop while playing stops there, and a story paused just
// now, while playing up to 0.25 s before a stop (a room's pause lands that close), waits at it too (SLIDE.at, which
// shows Next); a clock put near a stop while paused (a scrub) stays where it was put, unless right on it. In a shared
// room the station's clock also moves a playing story on between frames (catching up): a step since the last frame
// no longer than the time that passed (and the room's 0.25 s drift) counts as playing on too; a jump does not
function slideStep(t0) {
  const was = SLIDE.at, now = performance.now(), st = HOST.collab && HOST.collab.live && HOST.collab.live();
  const from = st && st.story === XR_HERE && SLIDE.lp && APP.t >= SLIDE.last && APP.t - SLIDE.last < (now - SLIDE.lt) / 1000 + 0.35 ? SLIDE.last : t0;
  SLIDE.at = -1;
  if (slidesOn() && APP.mode === 'story') {
    for (let i = 0; i < CH.length; i++) {
      const s = slideStop(i);
      if (APP.playing && i !== SLIDE.go && from < s && APP.t >= s) { slideTail(i, APP.t); APP.playing = false; APP.seek(s); }
      else if (!APP.playing && SLIDE.lp && APP.t >= s - 0.25 && APP.t < s) slideTail(i, APP.t);
      else if (APP.playing || Math.abs(APP.t - s) > 0.002) continue;
      APP.t = s; SLIDE.at = i; break;
    }
    // gone on from a stop: it stays passed while the clock is near it (the narration may pull the clock back a hair)
    if (was >= 0 && APP.playing) SLIDE.go = was;
    else if (SLIDE.go >= 0 && Math.abs(APP.t - slideStop(SLIDE.go)) > 1) SLIDE.go = -1;
  } else SLIDE.go = -1;
  // a voice finishing its chapter: done once the story is back where the voice ended, or elsewhere
  const T = SLIDE.tail;
  if (T && (APP.mode !== 'story' || HOST.picking || APP.t < T.s - 0.01 || APP.t >= T.v)) SLIDE.tail = null;
  SLIDE.last = APP.t; SLIDE.lt = now; SLIDE.lp = APP.mode === 'story' && APP.playing;
}
// at the stop of chapter i the voice plays on from where the sound is (the story's clock, t, can lag it) to where the
// chapter's words end; a sound already past them stops there, and keeps quiet until the story is back there
function slideTail(i, t) {
  const p = AUD && AUD.pos ? AUD.pos() : null, e = slideVoice(i);
  // (only a sound that is with the story: right after a jump it still says where it was before)
  const near = p !== null && Math.abs(p - t) < 1.5;
  if (near) t = p;
  SLIDE.tail = e > t || near ? { s: slideStop(i), v: Math.max(e, t), t, at: performance.now() } : null;
}
// what the narration plays (audioSync): the story's clock while it plays; while a voice finishes its chapter, its own
// clock up to the chapter's voice end, then nothing until the story, gone on from the stop, is back there. So nothing
// is cut or said twice, and the story does not follow the voice meanwhile (audioFollow)
function slideSound() {
  const T = SLIDE.tail, v = T ? T.t + (performance.now() - T.at) / 1000 : 0;
  return T ? [APP.mode === 'story' && v < T.v, Math.min(v, T.v)] : [APP.mode === 'story' && APP.playing, APP.t];
}
function slideNext() { if (SLIDE.at >= 0) APP.togglePlay(); }
function slideToggle() { if (HOST.slides) HOST.slides.set(XR_HERE, !slidesOn()); }
const slideSig = () => (HOST.slides ? HOST.slides.sig() : '') + SLIDE.at;
// the page: Next while the story waits (index.html's row at the foot of the panel, brought into sight as far as the
// chapter's top allows; on a phone, beside Play in the bar instead) and the switch
function slideDOM() {
  const row = $('#slides');
  if (!row || !HOST.slides) return;
  const on = slidesOn(), s = SLIDE.at + '' + on, nb = $('#btnNext'), bar = $('#btnNextBar');
  if (row.dataset.s === s) return;
  row.dataset.s = s; row.hidden = false;
  nb.hidden = SLIDE.at < 0;
  if (bar) bar.hidden = SLIDE.at < 0;
  const b = $('#btnSlides');
  b.textContent = 'Slideshow: ' + (on ? 'on' : 'off'); b.setAttribute('aria-pressed', on ? 'true' : 'false');
  if (SLIDE.at < 0 || !nb.offsetParent) return;
  const p = $('#panel'), r = p.getBoundingClientRect(), cs = getComputedStyle(p), sec = $('#story .ch.on');
  const over = Math.min(row.getBoundingClientRect().bottom - (r.bottom - parseFloat(cs.paddingBottom)), sec ? sec.getBoundingClientRect().top - r.top - parseFloat(cs.paddingTop) : 0);
  if (over > 0) p.scrollTo({ top: p.scrollTop + over, behavior: 'smooth' });
}

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
    Object.assign(XS, { org: ORGS.length, node_reveal: 1, route_reveal: 1, id_reveal: 1, id_alpha: 1, focus: 0, path_prog: 0, sel_prog: 0, prox: 0,
      ex_alpha: 0, cue_alpha: 0, path_alpha: 1 });
    // a move that was under way in the story finishes; the explore cell starts at rest otherwise
    MOVES.forEach((m, k) => { X.scen[k] = XS['s' + k] > 0.5 ? 1 : 0; X.moveT[k] = X.scen[k] ? -1 : -1; XS['s' + k] = X.scen[k]; });
    ST.labels.forEach(L => { L.el.style.opacity = 0; L.o = 0; });
    setFocus(X.path, true);
    renderMoves();
    updateExtraLabels();
    $('#panel').scrollTop = 0;
  },
  enterStory(t) {
    this.mode = 'story';
    document.body.classList.remove('exploring');
    $('#btnMode').textContent = 'Explore now';
    setFocus(null);
    setActors([]);
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
  const t0 = APP.t;
  if (APP.mode === 'story' && APP.playing) {
    APP.t += dt;
    audioFollow();
  }
  slideStep(t0);   // slideshow: the story waits at the end of each chapter
  // the end: Repeat (shell) starts this story or the next one again, else explore mode opens
  if (APP.mode === 'story' && APP.playing && APP.t >= T_END) { APP.t = T_END; if (HOST.ended()) APP.playing = false; else APP.enterExplore(); }
  audioSync();
  const ts = storyT(APP.t); // original story time for this point in the narration
  if (APP.mode === 'story') {
    S = storyState(ts);
    if (xr) xrPlaceGlobe(storyCam(ts)); else applyCamera(storyCam(ts));
    updateStoryDOM(ts);
    storyActors(ts);
    updateTimeline(APP.t, APP.playing);
  } else {
    S = exploreStep(dt, performance.now());
    orbitStep(xr ? performance.now() : now);
    if (xr) xrPlaceGlobe(orbit.cur); else applyCamera(orbit.cur);
  }
  applyUniforms(S, APP.mode === 'explore');
  GL.camera.updateMatrixWorld();
  updateLight(xr);
  if (xr) xrUpdate(S);
  GL.renderer.render(GL.scene, GL.camera);
  if (!xr) {
    if (APP.mode === 'story') placeLabels(ST.labels, L => fadeVal(ts, L.tIn, L.tOut, 0.5));
    else placeLabels(LBL.extra, () => 1);
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
  setFocus(null);
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
    if (hp.get('cell')) setView('cell', hp.get('cell'));
    if (hp.get('tab')) showTab(hp.get('tab'));
    if (hp.get('iso')) { X.iso = +hp.get('iso'); renderPlaces(); }
    if (hp.get('q')) { $('#q').value = hp.get('q'); runQuery(hp.get('q')); }
    if (hp.get('move')) hp.get('move').split(',').forEach(m => { if (MV[m] !== undefined) { setMove(MV[m], true); if (hp.has('now')) { X.moveT[MV[m]] = -1e9; XS['s' + MV[m]] = 1; } } });
    if (hp.get('bait')) setBait(CP(hp.get('bait')));
    if (hp.get('nofly')) { orbit.cur = orbit.to || orbit.cur; orbit.to = null; }
  }
  GL.renderer.setAnimationLoop(frame); // also drives the headset's frame loop
  if (HOST.session && GL.renderer.xr.isPresenting) xrAdopt();
  setTimeout(() => $('#loading').classList.add('gone'), 120);
}
const initT = setTimeout(init, 40);

// what the app shell needs to change story
return {
  inputs: () => XR.ctrls.map(c => c.src),
  xrPose: () => (XR.on ? { rp: GL.rig.position.clone(), rq: GL.rig.quaternion.clone(), off: XR.globeOff.clone(), s: XR.size, held: XR.ctrls.map(c => (c.grab ? c.grab.target : '')).join(' '),
    pp: XR.panelGroup.position.clone(), pr: yawOf(XR.panelGroup.quaternion, XR.panelGroup.rotation.y), rot: XR.rot.clone(), pq: XR.panelGroup.quaternion.clone() } : null),
  // shared rooms (shared.js): the clock is APP's, the shared state the explore tabs and controls (no one-shot effects)
  collab: {
    APP, scene: () => GL.scene, state: collabState, apply: collabApply, view: collabView, setView: collabSetView,
    hover: i => { const c = XR.ctrls[i]; return c && c.hover ? c.ray.scale.z : 0; },
    panel(p, yaw, q) { xrPanelPose(p, yaw, q); },
    place(o, s, q) { XR.globeOff.fromArray(o); XR.size = s; xrSceneRot(q); },
  },
  // for tests and the browser console: HOST.cur.peek('NET.N')
  peek: src => eval(src),
  dispose() {
    // timers left running must not write into the next story's panes (they share ids) or build this one after all
    clearTimeout(initT); clearTimeout(xrMsg.t); clearTimeout(setMove.t);
    if (GL.mo) GL.mo.disconnect();
    if (XR.session) XR.session.removeEventListener('visibilitychange', xrVisibility);
    if (GL.scene) GL.scene.traverse(o => {
      if (o.geometry) o.geometry.dispose();
      if (o.material) [].concat(o.material).forEach(m => { if (m.map) m.map.dispose(); if (m.uniforms) for (const u of Object.values(m.uniforms)) if (u.value && u.value.isTexture) u.value.dispose(); m.dispose(); });
    });
  },
};
});
