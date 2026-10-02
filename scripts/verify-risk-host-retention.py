"""Read-only checks of original rejected containers, including the separate coordinate correction."""
import hashlib,json,pathlib,subprocess,zipfile
base=pathlib.Path('evidence/risk-scoring-reference/v1/rejected-candidates')
sha=lambda raw:'sha256:'+hashlib.sha256(raw).hexdigest()
cases=[('594ba2d-first-install','94e4cb93493df6f2d82e04338b3fae41bc2f868c'),('69ca522-first-mapper','99e4281c05f311b4439eb5d532a8b4a2fcaab3bd'),('8ff5df5-first-reader',None)]
results=[]
for name,introduced in cases:
    folder=base/name;ledger=json.loads((folder/'retention.json').read_bytes());raw=(folder/ledger['container']).read_bytes()
    if introduced is None:introduced=subprocess.check_output(['git','log','--format=%H','--diff-filter=A','--',str(folder/'retention.json')],text=True).strip()
    assert len(raw)==ledger['containerBytes'] and sha(raw)==ledger['sha256']
    for member in ['retention.json','observations.zip']:
        original=subprocess.check_output(['git','show',f'{introduced}:{(folder/member).as_posix()}'])
        current=(folder/member).read_bytes()
        assert current==original or member.endswith('.json') and current.replace(b'\r\n',b'\n')==original
    with zipfile.ZipFile(folder/ledger['container']) as archive:
        assert sorted(archive.namelist())==sorted(e['path'] for e in ledger['members'])
        for member in ledger['members']:
            content=archive.read(member['path']);assert len(content)==member['bytes'] and sha(content)==member['sha256']
        source=json.loads(archive.read('source.json'));manifest=json.loads(archive.read('manifest.json'))
        for member in manifest['files']:
            content=archive.read(member['path']);assert len(content)==member['bytes'] and sha(content)==member['sha256']
        revision=source['revision'];assert manifest['sourceRevision']==revision
        tree=subprocess.check_output(['git','rev-parse',f'{revision}^{{tree}}'],text=True).strip();assert source['tree']==tree
        if name=='69ca522-first-mapper':
            correction=json.loads((folder/'coordinate-correction.json').read_bytes())
            assert correction['originalRetainerCommit']==introduced and correction['originalWrongSource']==ledger['sourceRevision']
            assert correction['containerSHA256']==sha(raw) and correction['sourceRevision']==revision and correction['sourceTree']==tree
            blob=subprocess.check_output(['git','rev-parse',f'{introduced}:{(folder/"retention.json").as_posix()}'],text=True).strip()
            assert correction['originalLedgerGitBlob']==blob
            assert json.loads(archive.read('config.json'))['executionBuild']['sourceRevision']==revision
            requests=[json.loads(archive.read(e['path'])) for e in ledger['members'] if e['path'].startswith('risk-requests/')]
            assert any(r['decision']=='WITHHELD' and r['score'] is None for r in requests)
            stopped=json.loads(archive.read('independent-shutdown.json'));assert stopped['observations'] and all(not p['alive'] for p in stopped['observations'])
        elif name=='594ba2d-first-install':
            failure=json.loads(archive.read('first-failure.json'));assert failure['revision']==revision
            assert ledger['sourceRevision']==revision
            assert 'pinned_requirements' in failure['message']
            assert json.loads(archive.read('independent-shutdown.json'))['observations']==[]
        else:
            assert ledger['sourceRevision']==revision
            readback=json.loads(archive.read('independent-readback.json'))
            assert readback['verdict']=='FAIL' and any('fixed four-column typed request' in f for f in readback['failures'])
            receipt=json.loads(archive.read('receipt.json'));assert len(receipt['requests'])==7 and receipt['allOwnedWorkersStopped']
            stopped=json.loads(archive.read('independent-shutdown.json'));assert len(stopped['observations'])==6 and all(not p['alive'] for p in stopped['observations'])
    results.append({'candidate':revision,'originalRetainer':introduced,'members':len(ledger['members']),'containerSha256':sha(raw),'verdict':'PASS'})
print(json.dumps({'verdict':'PASS','originalRejectedCandidates':results},indent=2))
