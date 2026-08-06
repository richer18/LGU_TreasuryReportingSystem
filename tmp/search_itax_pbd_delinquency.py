import glob,re,os
for path in glob.glob(r"C:\ITAX\*.pbd"):
    data=open(path,'rb').read()
    matches=[]
    for raw in re.findall(rb'[\x20-\x7e]{6,}',data):
        text=raw.decode('latin1','ignore')
        if 'delinq' in text.lower():
            matches.append(text[:1000])
    if matches:
        print('FILE',os.path.basename(path),'MATCHES',len(matches))
        for item in matches[:80]: print(item)