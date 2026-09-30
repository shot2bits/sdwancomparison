import importlib.util
s=importlib.util.spec_from_file_location('normaliser','scripts/normalise-provider-staging.py');m=importlib.util.module_from_spec(s);s.loader.exec_module(m)
assert m.sector_support('Strong fit, extensively evidenced')=='supported'
assert m.sector_support('Good fit, evidenced, though no formal HIPAA attestation found')=='supported'
assert m.sector_support('Conditional - no formal general attestation was found')=='requires_confirmation'
assert m.sector_support('Unknown - not assessed, no case study found')=='requires_confirmation'
assert m.sector_support('Not primary')=='requires_confirmation'
assert m.sector_support('Not supported for this sector')=='not_supported'
assert m.sector_case_strength('A named-role review, not sector-specific')=='unknown'
assert m.sector_case_strength('No case study found')=='none'
print('PASS sector import does not turn incidental no into unsupported or narrative into strong evidence')
