export interface ExampleTemplate {
  id: string;
  name: string;
  description: string;
  code: string;
}

export const EXAMPLES: ExampleTemplate[] = [
  {
    "id": "sqlite-arch",
    "name": "SQLite Architecture",
    "description": "Complete architecture diagram of SQLite (Core, Backend, SQL Compiler, Accessories)",
    "code": "lineht *= 0.4\n    $margin = lineht*2.5\n    scale = 0.75\n    fontscale = 1.1\n    charht *= 1.15\n    down\nIn: box \"Interface\" wid 150% ht 75% fill white\n    arrow\nCP: box same \"SQL Command\" \"Processor\"\n    arrow\nVM: box same \"Virtual Machine\"\n    arrow down 1.25*$margin\nBT: box same \"B-Tree\"\n    arrow\n    box same \"Pager\"\n    arrow\nOS: box same \"OS Interface\"\n    box same with .w at 1.25*$margin east of 1st box.e \"Tokenizer\"\n    arrow\n    box same \"Parser\"\n    arrow\nCG: box same ht 200% \"Code\" \"Generator\"\nUT: box same as 1st box at (Tokenizer,Pager) \"Utilities\"\n    move lineht\nTC: box same \"Test Code\"\n    arrow from CP to 1/4<Tokenizer.sw,Tokenizer.nw> chop\n    arrow from 1/3<CG.nw,CG.sw> to CP chop\n\n    box ht (In.n.y-VM.s.y)+$margin wid In.wid+$margin \\\n       at CP fill 0xd8ecd0 behind In\n    line invis from 0.25*$margin east of last.sw up last.ht \\\n        \"Core\" italic aligned\n\n    box ht (BT.n.y-OS.s.y)+$margin wid In.wid+$margin \\\n       at Pager fill 0xd0ece8 behind In\n    line invis from 0.25*$margin east of last.sw up last.ht \\\n       \"Backend\" italic aligned\n\n    box ht (Tokenizer.n.y-CG.s.y)+$margin wid In.wid+$margin \\\n       at 1/2<Tokenizer.n,CG.s> fill 0xe8d8d0 behind In\n    line invis from 0.25*$margin west of last.se up last.ht \\\n       \"SQL Compiler\" italic aligned\n\n    box ht (UT.n.y-TC.s.y)+$margin wid In.wid+$margin \\\n       at 1/2<UT,TC> fill 0xe0ecc8 behind In\n    line invis from 0.25*$margin west of last.se up last.ht \\\n      \"Accessories\" italic aligned"
  },
  {
    "id": "how-to-build",
    "name": "How To Build Pikchr",
    "description": "Build pipeline and code generation flow using lemon parser generator",
    "code": "filewid *= 1.2\n  Src:      file \"pikchr.y\"; move\n  LemonSrc: file \"lemon.c\"; move\n  Lempar:   file \"lempar.c\"; move\n            arrow down from LemonSrc.s\n  CC1:      oval \"C-Compiler\" ht 50%\n            arrow \" generates\" ljust above\n  Lemon:    oval \"lemon\" ht 50%\n            arrow from Src chop down until even with CC1 \\\n              then to Lemon.nw rad 20px\n            \"Pikchr source \" rjust \"code input \" rjust \\\n              at 2nd vertex of previous\n            arrow from Lempar chop down until even with CC1 \\\n              then to Lemon.ne rad 20px\n            \" parser template\" ljust \" resource file\" ljust \\\n              at 2nd vertex of previous\n  PikSrc:   file \"pikchr.c\" with .n at lineht below Lemon.s\n            arrow from Lemon to PikSrc chop\n            arrow down from PikSrc.s\n  CC2:      oval \"C-Compiler\" ht 50%\n            arrow\n  Out:      file \"pikchr.o\" \"or\" \"pikchr.exe\" wid 110%"
  },
  {
    "id": "syntax-diagram",
    "name": "Syntax Diagram",
    "description": "Railroad syntax diagram for object-definition grammar rule",
    "code": "$r = 0.2in\nlinerad = 0.75*$r\nlinewid = 0.25\n\n# Start and end blocks\n#\nbox \"element\" bold fit\nline down 50% from last box.sw\ndot rad 250% color black\nX0: last.e + (0.3,0)\narrow from last dot to X0\nmove right 3.9in\nbox wid 5% ht 25% fill black\nX9: last.w - (0.3,0)\narrow from X9 to last box.w\n\n\n# The main rule that goes straight through from start to finish\n#\nbox \"object-definition\" italic fit at 11/16 way between X0 and X9\narrow to X9\narrow from X0 to last box.w\n\n# The LABEL: rule\n#\narrow right $r from X0 then down 1.25*$r then right $r\noval \" LABEL \" fit\narrow 50%\noval \"\\\":\\\"\" fit\narrow 200%\nbox \"position\" italic fit\narrow\nline right until even with X9 - ($r,0) \\\n  then up until even with X9 then to X9\narrow from last oval.e right $r*0.5 then up $r*0.8 right $r*0.8\nline up $r*0.45 right $r*0.45 then right\n\n# The VARIABLE = rule\n#\narrow right $r from X0 then down 2.5*$r then right $r\noval \" VARIABLE \" fit\narrow 70%\nbox \"assignment-operator\" italic fit\narrow 70%\nbox \"expr\" italic fit\nline right until even with X9 - ($r,0) \\\n  then up until even with X9 then to X9\n\n# The PRINT rule\n#\narrow right $r from X0 then down 3.75*$r then right $r\noval \"\\\"print\\\"\" fit\narrow\nbox \"print-args\" italic fit\nline right until even with X9 - ($r,0) \\\n  then up until even with X9 then to X9"
  },
  {
    "id": "swimlanes",
    "name": "Swimlanes Flowchart",
    "description": "Multi-lane cross-functional business process flowchart",
    "code": "$laneh = 0.75\n\n    # Draw the lanes\n    down\n    box width 3.5in height $laneh fill 0xacc9e3\n    box same fill 0xc5d8ef\n    box same as first box\n    box same as 2nd box\n    line from 1st box.sw+(0.2,0) up until even with 1st box.n \\\n      \"Alan\" above aligned\n    line from 2nd box.sw+(0.2,0) up until even with 2nd box.n \\\n      \"Betty\" above aligned\n    line from 3rd box.sw+(0.2,0) up until even with 3rd box.n \\\n      \"Charlie\" above aligned\n    line from 4th box.sw+(0.2,0) up until even with 4th box.n \\\n       \"Darlene\" above aligned\n\n    # fill in content for the Alice lane\n    right\nA1: circle rad 0.1in at end of first line + (0.2,-0.2) \\\n       fill white thickness 1.5px \"1\" \n    arrow right 50%\n    circle same \"2\"\n    arrow right until even with first box.e - (0.65,0.0)\n    ellipse \"future\" fit fill white height 0.2 width 0.5 thickness 1.5px\nA3: circle same at A1+(0.8,-0.3) \"3\" fill 0xc0c0c0\n    arrow from A1 to last circle chop \"fork!\" below aligned\n\n    # content for the Betty lane\nB1: circle same as A1 at A1-(0,$laneh) \"1\"\n    arrow right 50%\n    circle same \"2\"\n    arrow right until even with first ellipse.w\n    ellipse same \"future\"\nB3: circle same at A3-(0,$laneh) \"3\"\n    arrow right 50%\n    circle same as A3 \"4\"\n    arrow from B1 to 2nd last circle chop\n\n    # content for the Charlie lane\nC1: circle same as A1 at B1-(0,$laneh) \"1\"\n    arrow 50%\n    circle same \"2\"\n    arrow right 0.8in \"goes\" \"offline\"\nC5: circle same as A3 \"5\"\n    arrow right until even with first ellipse.w \\\n      \"back online\" above \"pushes 5\" below \"pulls 3 &amp; 4\" below\n    ellipse same \"future\"\n\n    # content for the Darlene lane\nD1: circle same as A1 at C1-(0,$laneh) \"1\"\n    arrow 50%\n    circle same \"2\"\n    arrow right until even with C5.w\n    circle same \"5\"\n    arrow 50%\n    circle same as A3 \"6\"\n    arrow right until even with first ellipse.w\n    ellipse same \"future\"\nD3: circle same as B3 at B3-(0,2*$laneh) \"3\"\n    arrow 50%\n    circle same \"4\"\n    arrow from D1 to D3 chop"
  },
  {
    "id": "graphs",
    "name": "Trees and Graphs",
    "description": "Binary tree and connected network graph with custom styling",
    "code": "scale = 0.8\nfill = white\nlinewid *= 0.5\ncircle \"C0\" fit\ncirclerad = previous.radius\narrow\ncircle \"C1\"\narrow\ncircle \"C2\"\narrow\ncircle \"C4\"\narrow\ncircle \"C6\"\ncircle \"C3\" at dist(C2,C4) heading 30 from C2\narrow\ncircle \"C5\"\narrow from C2 to C3 chop\nC3P: circle \"C3&#39;\" at dist(C4,C6) heading 30 from C6\narrow right from C3P.e\nC5P: circle \"C5&#39;\"\narrow from C6 to C3P chop\n\nbox height C3.y-C2.y \\\n    width (C5P.e.x-C0.w.x)+linewid \\\n    with .w at 0.5*linewid west of C0.w \\\n    behind C0 \\\n    fill 0xc6e2ff thin color gray\nbox same width previous.e.x - C2.w.x \\\n    with .se at previous.ne \\\n    fill 0x9accfc\n\"trunk\" below at 2nd last box.s\n\"feature branch\" above at last box.n\n\ncircle \"C0\" at 3.7cm south of C0\narrow\ncircle \"C1\"\narrow\ncircle \"C2\"\narrow\ncircle \"C4\"\narrow\ncircle \"C6\"\ncircle \"C3\" at dist(C2,C4) heading 30 from C2\narrow\ncircle \"C5\"\narrow\ncircle \"C7\"\narrow from C2 to C3 chop\narrow from C6 to C7 chop\n\nbox height C3.y-C2.y \\\n    width (C7.e.x-C0.w.x)+1.5*C1.radius \\\n    with .w at 0.5*linewid west of C0.w \\\n    behind C0 \\\n    fill 0xc6e2ff thin color gray\nbox same width previous.e.x - C2.w.x \\\n    with .se at previous.ne \\\n    fill 0x9accfc\n\"trunk\" below at 2nd last box.s\n\"feature branch\" above at last box.n"
  },
  {
    "id": "pic-compiler-pipeline",
    "name": "Compiler Pipeline (Kernighan)",
    "description": "Classic Lexical Analyzer, Parser, and Code Generator pipeline",
    "code": "arrow \"source\" \"code\"\nLA:     box \"lexical\" \"analyzer\"\n        arrow \"tokens\" above\nP:      box \"parser\"\n        arrow \"intermediate\" \"code\" wid 200%\nSem:    box \"semantic\" \"checker\"\n        arrow\n        arrow <-> up from top of LA\nLC:     box \"lexical\" \"corrector\"\n        arrow <-> up from top of P\nSyn:    box \"syntactic\" \"corrector\"\n        arrow up\nDMP:    box \"diagnostic\" \"message\" \"printer\"\n        arrow <-> right  from east of DMP\nST:     box \"symbol\" \"table\"\n        arrow from LC.ne to DMP.sw\n        arrow from Sem.nw to DMP.se\n        arrow <-> from Sem.top to ST.bot"
  },
  {
    "id": "pic-cpu-system",
    "name": "CPU & Peripherals (Kernighan)",
    "description": "CPU, Disk, CRT, and operator terminal system architecture",
    "code": "circle \"DISK\"\n        arrow \"character\" \"defns\" right 150%\nCPU:    box \"CPU\" \"(16-bit mini)\"\n        arrow <- from top of CPU up \"input \" rjust\n        move right from CPU.e\nCRT:    \"   CRT\" ljust\n        line from CRT - 0,0.075 up 0.15 \\\n                then right 0.5 \\\n                then right 0.5 up 0.25 \\\n                then down 0.5+0.15 \\\n                then left 0.5 up 0.25 \\\n                then left 0.5\n        arrow from CPU.e right until even with previous.start\nPaper:  CRT + 1.05,0.75\n        arrow <- from Paper down 1.5\n        \" ...  paper\" ljust at end of last arrow + 0, 0.25\n        circle rad 0.05 at Paper + (-0.055, -0.25)\n        circle rad 0.05 at Paper + (0.055, -0.25)\n        \"   rollers\" ljust at Paper + (0.1, -0.25)"
  },
  {
    "id": "pic-nested-blocks",
    "name": "Nested Blocks (Kernighan)",
    "description": "Multi-tiered structured block diagram with define macros",
    "code": "define ndblock {\n  box wid boxwid/2 ht boxht/2\n  down;  box same with .t at bottom of last box;   box same\n}\nboxht = .2; boxwid = .3; circlerad = .3; dx = 0.05\ndown; box; box; box; box ht 3*boxht \".\" \".\" \".\"\nL: box; box; box invis wid 2*boxwid \"hashtab:\" with .e at 1st box .w\nright\nStart: box wid .5 with .sw at 1st box.ne + (.4,.2) \"...\"\nN1: box wid .2 \"n1\";  D1: box wid .3 \"d1\"\nN3: box wid .4 \"n3\";  D3: box wid .3 \"d3\"\nbox wid .4 \"...\"\nN2: box wid .5 \"n2\";  D2: box wid .2 \"d2\"\narrow right from 2nd box\nndblock\nspline -> right .2 from 3rd last box then to N1.sw + (dx,0)\nspline -> right .3 from 2nd last box then to D1.sw + (dx,0)\narrow right from last box\nndblock\nspline -> right .2 from 3rd last box to N2.sw-(dx,.2) to N2.sw+(dx,0)\nspline -> right .3 from 2nd last box to D2.sw-(dx,.2) to D2.sw+(dx,0)\narrow right 2*linewid from L\nndblock\nspline -> right .2 from 3rd last box to N3.sw + (dx,0)\nspline -> right .3 from 2nd last box to D3.sw + (dx,0)\ncirclerad = .3\ncircle invis \"ndblock\"  at last box.e + (1.2,.2)\narrow dashed from last circle.w to 5/8<last circle.w,2nd last box> chop\nbox invis wid 2*boxwid \"ndtable:\" with .e at Start.w"
  },
  {
    "id": "usage-note",
    "name": "Usage Note Banner",
    "description": "Simple colored box with multi-line prominent text",
    "code": "box color red wid 2.6in \\\n    \"Click on any diagram on this page\" big \\\n    \"to see the Pikchr source text\" big"
  }
];
