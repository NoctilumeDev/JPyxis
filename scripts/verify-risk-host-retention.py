"""Read-only byte/source checks of original rejected and bounded qualified containers."""
import contextlib,hashlib,json,pathlib,subprocess,zipfile

from external_evidence_consumer import (acquire_verified_object,load_migration_ledger,require_coordinate,
                                        verify_bound_file,verify_zip_members)

base=pathlib.Path('evidence/risk-scoring-reference/v1/rejected-candidates')
sha=lambda raw:'sha256:'+hashlib.sha256(raw).hexdigest()
pilot_ledger=pathlib.Path('archive/historical-residuals/migration-ledgers/external-evidence-pilot-v1.json')
pilot_record=load_migration_ledger(pilot_ledger)
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
folder=base/'a6b11dd-premature-rollback';ledger=json.loads((folder/'raw-retention.json').read_bytes());raw=(folder/'raw-observations.zip').read_bytes()
assert len(raw)==ledger['containerBytes'] and sha(raw)==ledger['sha256']
with zipfile.ZipFile(folder/'raw-observations.zip') as archive:
    assert sorted(archive.namelist())==sorted(m['path'] for m in ledger['members'])
    for member in ledger['members']:
        content=archive.read(member['path']);assert len(content)==member['bytes'] and sha(content)==member['sha256']
    witness=json.loads(archive.read('witness.json'))
    for member in witness['files']:
        content=archive.read(member['path']);assert len(content)==member['bytes'] and sha(content)==member['sha256']
    tree=subprocess.check_output(['git','rev-parse',witness['sourceRevision']+'^{tree}'],text=True).strip();assert tree==witness['sourceTree']
    assert json.loads(archive.read('risk-host-entry.json'))['executionBuild']['sourceRevision']==witness['sourceRevision']
    assert json.loads(archive.read('receipt.json'))['allOwnedWorkersStopped']
results.append({'candidate':witness['sourceRevision'],'classification':'UI premature rollback eligibility projection; no invalid action fired','containerSha256':sha(raw),'verdict':'PASS'})
visual=[]
for name in ['polish-v2','polish-v3']:
    folder=pathlib.Path('evidence/risk-scoring-reference/v1/design-qa')/name
    ledger=json.loads((folder/'raw-retention.json').read_bytes())
    if name=='polish-v2':
        require_coordinate(pilot_record,'originalGitPath',(folder/ledger['container']).as_posix())
        verify_bound_file(pilot_record,path_field='memberLedgerPath',digest_field='memberLedgerSha256',
                          expected_path=folder/'raw-retention.json')
        verify_bound_file(pilot_record,path_field='claimRecordPath',digest_field='claimRecordSha256',
                          expected_path=folder/'iteration.json')
        container_context=acquire_verified_object(pilot_record)
    else:
        container_context=contextlib.nullcontext(folder/ledger['container'])
    with container_context as container:
        verify_zip_members(container,folder/'raw-retention.json')
        raw=container.read_bytes()
        assert len(raw)==ledger['containerBytes'] and sha(raw)==ledger['sha256']
        with zipfile.ZipFile(container) as archive:
            assert sorted(archive.namelist())==sorted(m['path'] for m in ledger['members'])
            for member in ledger['members']:
                content=archive.read(member['path'])
                assert len(content)==member['bytes'] and sha(content)==member['sha256']
            source=json.loads(archive.read('source.json'))
            config=json.loads(archive.read('config.json'))
            assert source['revision']==ledger['sourceRevision']==config['executionBuild']['sourceRevision']
            tree=subprocess.check_output(['git','rev-parse',source['revision']+'^{tree}'],text=True).strip()
            assert source['tree']==tree==config['executionBuild']['sourceTree']
            if name=='polish-v2':
                require_coordinate(pilot_record,'sourceRevision',source['revision'])
                require_coordinate(pilot_record,'sourceTree',source['tree'])
            receipt=json.loads(archive.read('receipt.json'))
            assert len(receipt['requests'])==5 and receipt['allOwnedWorkersStopped']
            shutdown=json.loads(archive.read('independent-shutdown.json'))
            assert len(shutdown['observations'])==6 and all(not o['alive'] for o in shutdown['observations'])
            iteration=json.loads((folder/'iteration.json').read_bytes())
            assert iteration['sourceRevision']==source['revision']
            construction=json.loads(archive.read('construction.json'))
            assert iteration['installedArtifactSha256']==construction['javaArtifactSha256']
        visual.append({'candidate':source['revision'],'visualStatus':'SUPERSEDED' if name=='polish-v2' else 'PASS',
                       'containerSha256':sha(raw),'retentionVerdict':'PASS'})
qualified=[]
qualified_base=pathlib.Path('evidence/risk-scoring-reference/v1/qualification-inputs')
canonical='151785c281e8e18f8e023c301009f0f1c53e32f2'
for name in ['implementation-pr','implementation-main','installed-main']:
    folder=qualified_base/name;ledger=json.loads((folder/'retention.json').read_bytes())
    raw=(folder/ledger['container']).read_bytes()
    assert len(raw)==ledger['containerBytes'] and sha(raw)==ledger['sha256']
    with zipfile.ZipFile(folder/ledger['container']) as archive:
        assert sorted(archive.namelist())==sorted(m['path'] for m in ledger['members'])
        for member in ledger['members']:
            content=archive.read(member['path'])
            assert len(content)==member['bytes'] and sha(content)==member['sha256']
        if name!='installed-main':
            coordinate=json.loads((folder/'source-coordinate.json').read_bytes())
            assert coordinate['executedSource']==ledger['executedSource']
            assert coordinate['canonicalEquivalentMain']==canonical
            coord_raw=(folder/coordinate['container']).read_bytes()
            assert len(coord_raw)==coordinate['containerBytes'] and sha(coord_raw)==coordinate['sha256']
            with zipfile.ZipFile(folder/coordinate['container']) as objects:
                assert sorted(objects.namelist())==['commit.bin','tree.bin']
                for member in coordinate['members']:
                    content=objects.read(member['path'])
                    assert len(content)==member['bytes'] and sha(content)==member['sha256']
                    header=f"{member['gitType']} {len(content)}\0".encode()
                    assert hashlib.sha1(header+content).hexdigest()==member['gitObject']
                assert objects.read('commit.bin').splitlines()[0]==('tree '+coordinate['sourceTree']).encode()
            canonical_tree=subprocess.check_output(['git','rev-parse',canonical+'^{tree}'],text=True).strip()
            assert coordinate['sourceTree']==canonical_tree
            ci=json.loads(archive.read('metadata/ci.json'))
            assert ci['run']==ledger['run'] and ci['executedSha']==ledger['executedSource']
            assert ci['conclusion']=='success' and len(ci['jobs'])==4
            assert all(j['conclusion']=='success' for j in ci['jobs'])
            assert set(ci['artifacts'])=={'risk','reference','m4','m4-clean','m5','m6'}
            assert all(a['sha']==ledger['executedSource'] for a in ci['artifacts'].values())
            source_paths=[p for p in archive.namelist() if p.startswith('risk/') and p.endswith('/source.json')]
            assert len(source_paths)==1
            source=json.loads(archive.read(source_paths[0]))
            assert source['revision']==ledger['executedSource'] and source['tree']==canonical_tree
            assert source['publicClean'] and not source['localMavenReuse']
            risk=json.loads(archive.read('metadata/risk-readback.json'))
            assert risk['executedSource']==ledger['executedSource']
            assert risk['actual']['verdict']=='PASS' and risk['actual']['requests']==7
            assert risk['actual']['actualWorkers']==3 and risk['mutations']['verdict']=='PASS'
        else:
            assert ledger['sourceRevision']==canonical
            source=json.loads(archive.read('source.json'))
            assert source['revision']==canonical and not source['publicClean'] and source['localMavenReuse']
            assert source['tree']==subprocess.check_output(['git','rev-parse',canonical+'^{tree}'],text=True).strip()
            receipt=archive.read('receipt.json')
            assert receipt==archive.read('ui-downloaded-receipt.json')
            assert len(json.loads(receipt)['requests'])==5 and json.loads(receipt)['allOwnedWorkersStopped']
            construction=json.loads(archive.read('construction.json'))
            assert construction['javaArtifactSha256']==sha(archive.read('artifacts/host.jar'))
            readback=json.loads(archive.read('metadata/installed-readback.json'))
            assert readback['expectedSource']==canonical and readback['result']['verdict']=='PASS'
            assert readback['result']['requests']==5 and readback['publicScenarioStillRequired']
            reader_blob=subprocess.check_output(['git','rev-parse',canonical+':scripts/verify-risk-host-evidence.mjs'],text=True).strip()
            assert readback['originalReaderGitBlob']==reader_blob
            shutdown=json.loads(archive.read('independent-shutdown.json'))
            assert len(shutdown['observations'])==6 and all(not p['alive'] for p in shutdown['observations'])
    qualified.append({'group':name,'containerSha256':sha(raw),'retentionVerdict':'PASS'})
print(json.dumps({'verdict':'PASS','originalRejectedCandidates':results,'visualObservations':visual,
                  'qualifiedInputContainers':qualified},indent=2))
