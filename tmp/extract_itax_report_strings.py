import re
path=r"C:\ITAX\itax_rptreport.pbd"
data=open(path,'rb').read()
terms=('delinq','tpaccount','debitamount','creditamount','earmark','previous td','computed as of','assessedvalue','casetype')
seen=set()
for raw in re.findall(rb'[\x20-\x7e]{8,}', data):
    text=raw.decode('latin1','ignore')
    if any(term in text.lower() for term in terms) and text not in seen:
        seen.add(text)
        print(text[:4000])
for raw in re.findall(rb'(?:[\x20-\x7e]\x00){8,}', data):
    text=raw.decode('utf-16le','ignore')
    if any(term in text.lower() for term in terms) and text not in seen:
        seen.add(text)
        print(text[:4000])
print('MATCHES',len(seen))