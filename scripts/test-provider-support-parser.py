import importlib.util
from pathlib import Path
s=importlib.util.spec_from_file_location('normaliser',Path(__file__).with_name('normalise-provider-staging.py'))
m=importlib.util.module_from_spec(s);s.loader.exec_module(m)
cases={
 'Native, confirmed directly - traffic steering':'supported',
 'Native - no additional appliance required':'supported',
 'Confirmed via partner integration':'partner_delivered',
 'Partner-delivered, confirmed':'partner_delivered',
 'Partial - partner deployment available':'partially_supported',
 'Not independently confirmed in sources reviewed':'requires_confirmation',
 'Not confirmed; native support requires checking':'requires_confirmation',
 'Requires confirmation from the vendor':'requires_confirmation',
 'Not supported; partner alternative available':'not_supported',
 'No - not in this product':'not_supported',
 'Not publicly disclosed':'not_publicly_disclosed',
 'Roadmap mentions a supported future product':'unknown',
 '':'unknown',
}
for text,expected in cases.items():assert m.support(text)==expected,(text,m.support(text),expected)
print(f'PASS: {len(cases)} support-parser regression cases')

long='Research evidence. '*600
assert long.strip() in m.full_qualification('architecture',{'finding':long,'evidence':'[1]'}), 'normalisation must retain qualifications beyond 4,000 characters'
assert 'Evidence: [1]' in m.full_qualification('architecture',{'finding':long,'evidence':'[1]'})
assert m.service_model('Fully managed deployment')=='fully_managed'
assert m.service_model('Co-managed deployment')=='co_managed'
assert m.service_model('Cloud-delivered')=='other'
print('PASS lossless labelled qualifications and explicit service-model mapping; no publication state change')
