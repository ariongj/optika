import { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown, ChevronLeft, ChevronRight, Menu, Search, X, ExternalLink, Plus, Archive, Copy, Download, Upload } from 'lucide-react';
import useDialogFocus from './useDialogFocus.js';
import { cmsNavigation, canCms, cmsSearch, parseCatalogueCsv, downloadCatalogue, blankRule, blankPlacement, cmsStatus } from './cmsWorkspace.js';
import './styles/cms-workspace.css';
const euro = n => new Intl.NumberFormat('sq-AL', {
  style: 'currency',
  currency: 'EUR'
}).format(Number(n || 0));
const when = value => value ? new Date(value).toLocaleString('sq-AL') : '—';
const label = {
  Products: 'Produktet',
  Orders: 'Porositë',
  Clients: 'Klientët',
  Appointments: 'Terminet',
  Contacts: 'Kontaktet'
};
function Field({
  label,
  children,
  ...props
}) {
  const [uploading, setUploading] = useState(false),
    [error, setError] = useState('');
  const imageField = label.startsWith('Imazhi ');
  return <label>{label}{children || <input aria-label={label} {...props} />}{imageField && <><input type="file" aria-label={`Ngarko: ${label}`} accept="image/jpeg,image/png,image/webp" disabled={uploading} onChange={async e => {
        const file = e.target.files?.[0];
        if (!file) return;
        setUploading(true);
        setError('');
        try {
          const session = await fetch('/api/index.php?resource=session', {
            credentials: 'same-origin',
            cache: 'no-store'
          }).then(r => r.json());
          if (!session.authenticated) throw new Error('Sesioni skadoi. Hyni përsëri.');
          const form = new FormData();
          form.append('file', file);
          const response = await fetch('/api/upload.php', {
            method: 'POST',
            credentials: 'same-origin',
            headers: {
              'X-CSRF-Token': session.csrf
            },
            body: form
          });
          const result = await response.json();
          if (!response.ok || !result.ok) throw new Error('Ngarkimi dështoi. Përdorni JPG, PNG ose WebP deri në 5 MB.');
          props.onChange?.({
            target: {
              value: result.url
            }
          });
        } catch (err) {
          setError(err.message);
        } finally {
          setUploading(false);
          e.target.value = '';
        }
      }} />{uploading && <small role="status">Duke ngarkuar…</small>}{error && <small role="alert">{error}</small>}</>}</label>;
}
function Panel({
  title,
  copy,
  children,
  action
}) {
  return <section className="cms-panel"><header><div><h2>{title}</h2>{copy && <p>{copy}</p>}</div>{action}</header>{children}</section>;
}
function Empty({
  children
}) {
  return <p className="cms-empty">{children || 'Nuk ka regjistrime për këtë përzgjedhje.'}</p>;
}
function Badge({
  record
}) {
  return <span className={`cms-badge status-${record.status}`}>{cmsStatus(record)}</span>;
}
function Schedule({
  draft,
  setDraft,
  canPublish
}) {
  return <div className="cms-fields"><Field label="Statusi"><select value={draft.status} onChange={e => setDraft({
        ...draft,
        status: e.target.value
      })}><option>Draft</option>{canPublish && <option value="Published">Publiko / planifiko</option>}<option value="Paused">Pezullo</option><option value="Archived">Arkivo</option></select></Field>{['startsAt', 'endsAt'].map((key, i) => <Field key={key} label={i ? 'Mbarimi (opsional)' : 'Fillimi (opsional)'} type="datetime-local" value={draft[key] ? new Date(Date.parse(draft[key]) - new Date(draft[key]).getTimezoneOffset() * 60000).toISOString().slice(0, 16) : ''} onChange={e => setDraft({
      ...draft,
      [key]: e.target.value ? new Date(e.target.value).toISOString() : ''
    })} />)}</div>;
}
function ProductSelect({
  title,
  value,
  onChange,
  products
}) {
  return <Field label={title}><select multiple size="5" value={value || []} onChange={e => onChange([...e.target.selectedOptions].map(o => o.value))}>{products.map(p => <option key={p.id} value={p.id}>{p.name} · {p.sku}</option>)}</select></Field>;
}
export function CmsNavigation({
  data,
  section,
  openSection,
  email,
  logout,
  busy
}) {
  const [mobile, setMobile] = useState(false),
    [search, setSearch] = useState('');
  const panel = useRef(null);
  useDialogFocus(mobile, panel, () => setMobile(false));
  const permissions = data.cms?.permissions || ['*'];
  const results = useMemo(() => cmsSearch(data, search), [data, search]);
  const select = (s, q = '') => {
    openSection(s, '', q);
    setMobile(false);
    setSearch('');
  };
  const entries = cmsNavigation.filter(n => canCms(permissions, n.permission));
  const nav = <nav aria-label="Menaxhimi i biznesit">{entries.map(n => <div key={n.label}>{n.group && <small className="cms-nav-group">{n.group}</small>}{n.children ? <details open={n.children.some(([, s]) => s === section) || undefined}><summary>{n.label}<ChevronDown size={14} /></summary><div>{n.children.filter(([,, p]) => canCms(permissions, p)).map(([text, s]) => <button key={s} aria-current={section === s ? 'page' : undefined} onClick={() => select(s)}>{text}</button>)}</div></details> : <button aria-current={section === n.section ? 'page' : undefined} onClick={() => select(n.section)}>{n.label}</button>}</div>)}</nav>;
  return <><header className="cms-global-header"><button className="cms-menu-trigger" aria-label="Hap menynë e CMS" aria-expanded={mobile} onClick={() => setMobile(true)}><Menu size={20} /></button><a href="/" className="cms-wordmark">MIFTARI <span>CMS</span></a><div className="cms-global-search"><Search size={17} /><input type="search" aria-label="Kërkim global në CMS" placeholder="Kërko produkte, porosi ose klientë…" value={search} onChange={e => setSearch(e.target.value)} onKeyDown={e => {
          if (e.key === 'Escape') setSearch('');
        }} />{search.length >= 2 && <div className="cms-search-results" aria-label="Rezultatet e kërkimit">{results.map((r, i) => <button key={i} onClick={() => select(r.section, r.query)}><span><strong>{r.title}</strong><small>{r.detail}</small></span><small>{label[r.section]}</small></button>)}{!results.length && <Empty>Nuk u gjet rezultat.</Empty>}</div>}</div><span className="cms-session-label">{email}</span><a href="/" aria-label="Hap dyqanin"><ExternalLink size={18} /></a></header><aside className="cms-desktop-nav">{nav}<button className="cms-logout" onClick={logout} disabled={busy}>Dil nga llogaria</button></aside>{mobile && <div className="cms-drawer-backdrop" onClick={() => setMobile(false)}><aside ref={panel} className="cms-mobile-nav" role="dialog" aria-modal="true" aria-label="Navigimi i CMS" onClick={e => e.stopPropagation()}><header><strong>Miftari CMS</strong><button aria-label="Mbyll menynë" onClick={() => setMobile(false)}><X size={20} /></button></header>{nav}<button className="cms-logout" onClick={logout} disabled={busy}>Dil nga llogaria</button></aside></div>}</>;
}
export function CmsCatalogue({
  products,
  onEdit,
  onNew,
  request,
  busy,
  permissions
}) {
  const [status, setStatus] = useState(''),
    [query, setQuery] = useState(''),
    [selected, setSelected] = useState([]),
    [page, setPage] = useState(0),
    [sort, setSort] = useState('name'),
    [preview, setPreview] = useState(null),
    [importRows, setImportRows] = useState(null),
    [error, setError] = useState('');
  const rows = products.filter(p => (!status || (p.status || 'Published') === status) && [p.name, p.sku, p.barcode, p.tags, p.collection].some(v => String(v || '').toLocaleLowerCase().includes(query.toLocaleLowerCase()))).sort((a, b) => sort === 'stock' ? Number(a.stock) - Number(b.stock) : String(a.name).localeCompare(String(b.name), 'sq'));
  const pages = Math.max(1, Math.ceil(rows.length / 15)),
    current = Math.min(page, pages - 1),
    visible = rows.slice(current * 15, current * 15 + 15);
  useEffect(() => {
    setPage(0);
    setSelected([]);
  }, [status, query]);
  const bulk = async next => {
    if (await request('bulk_products', {
      ids: selected,
      status: next
    }, 'Produktet u përditësuan.')) setSelected([]);
  };
  return <Panel title="Produktet" copy="Katalogu, publikimi dhe disponueshmëria." action={canCms(permissions, 'catalog.write') && <button className="primary" onClick={onNew}><Plus size={16} />Shto produkt</button>}><div className="cms-tabs" aria-label="Statusi i produkteve">{[['', 'Të gjitha'], ['Published', 'Aktive'], ['Draft', 'Draft'], ['Archived', 'Arkivuara']].map(([v, t]) => <button key={v} aria-pressed={status === v} onClick={() => setStatus(v)}>{t}</button>)}</div><div className="cms-list-tools"><input aria-label="Kërko produktet" type="search" placeholder="Emri, SKU, barkodi ose etiketa" value={query} onChange={e => setQuery(e.target.value)} /><select aria-label="Rendit produktet" value={sort} onChange={e => setSort(e.target.value)}><option value="name">Emri A–Z</option><option value="stock">Stoku më i ulët</option></select>{canCms(permissions, 'catalog.export') && <button onClick={() => downloadCatalogue(rows)}><Download size={15} />Eksporto</button>}{canCms(permissions, 'catalog.write') && <label className="cms-upload-button"><Upload size={15} />Import CSV<input type="file" accept=".csv,text/csv" onChange={async e => {
          const file = e.target.files?.[0];
          if (!file) return;
          try {
            if (file.size > 1000000) throw new Error('CSV duhet të jetë më i vogël se 1 MB.');
            const parsed = parseCatalogueCsv(await file.text());
            setImportRows(parsed);
            setPreview(await request('import_preview', {
              rows: parsed
            }));
            setError('');
          } catch (err) {
            setError(err.message);
          }
          e.target.value = '';
        }} /></label>}</div>{error && <p role="alert">{error}</p>}{preview && <div className="cms-import-preview"><h3>Parapamja e importit</h3><p>{preview.rows?.length} rreshta të vlefshëm · {preview.existing} SKU ekzistuese · {preview.errors?.length} gabime. Produktet ruhen si draft.</p>{preview.errors?.map(e => <p key={e.row}>Rreshti {e.row}: {e.message}</p>)}<button disabled={busy || !!preview.errors?.length} onClick={async () => {
        if (await request('import_commit', {
          rows: importRows,
          previewToken: preview.previewToken
        }, 'CSV u bashkua me katalogun.')) setPreview(null);
      }}>Importo {preview.rows?.length} produkte</button><button onClick={() => setPreview(null)}>Anulo</button></div>}{selected.length > 0 && <div className="cms-bulk"><strong>{selected.length} të zgjedhura</strong>{canCms(permissions, 'catalog.publish') && <button disabled={busy || !canCms(permissions, 'catalog.write')} onClick={() => bulk('Published')}>Publiko</button>}<button disabled={busy || !canCms(permissions, 'catalog.write')} onClick={() => bulk('Draft')}>Ruaj draft</button><button disabled={busy || !canCms(permissions, 'catalog.write')} onClick={() => bulk('Archived')}><Archive size={15} />Arkivo</button></div>}<div className="cms-table-scroll" tabIndex="0" aria-label="Tabela e produkteve"><table><thead><tr><th><input type="checkbox" aria-label="Zgjidh produktet në këtë faqe" checked={!!visible.length && visible.every(p => selected.includes(p.id))} onChange={e => setSelected(e.target.checked ? [...new Set([...selected, ...visible.map(p => p.id)])] : selected.filter(id => !visible.some(p => p.id === id)))} /></th><th>Produkti</th><th>Statusi</th><th>Çmimi</th><th>Inventari</th><th>Koleksioni</th><th>Veprime</th></tr></thead><tbody>{visible.map(p => <tr key={p.id}><td><input type="checkbox" aria-label={`Zgjidh ${p.name}`} checked={selected.includes(p.id)} onChange={e => setSelected(e.target.checked ? [...selected, p.id] : selected.filter(id => id !== p.id))} /></td><td><button className="cms-product-name" disabled={!canCms(permissions, 'catalog.write')} onClick={() => onEdit(p)}>{p.image && <img src={p.image} alt="" />}<span><strong>{p.name}</strong><small>{p.sku}</small></span></button></td><td><Badge record={{
                status: p.status || 'Published'
              }} /></td><td>{euro(p.salePrice || p.price)}</td><td>{p.stock} copë</td><td>{p.collection || '—'}</td><td><button aria-label={`Dupliko ${p.name}`} disabled={busy || !canCms(permissions, 'catalog.write')} onClick={() => request('duplicate_product', {
                id: p.id
              }, 'Kopja u ruajt si draft me stok zero.')}><Copy size={16} /></button></td></tr>)}</tbody></table></div>{!rows.length && <Empty />}<footer className="cms-pagination"><span>{rows.length} produkte · faqja {current + 1}/{pages}</span><button aria-label="Faqja e mëparshme" disabled={current === 0} onClick={() => setPage(current - 1)}><ChevronLeft size={17} /></button><button aria-label="Faqja tjetër" disabled={current + 1 >= pages} onClick={() => setPage(current + 1)}><ChevronRight size={17} /></button></footer></Panel>;
}
export function CmsModules({
  section,
  data,
  request,
  busy,
  openSection
}) {
  const cms = data.cms || {},
    permissions = cms.permissions || ['*'];
  const [draft, setDraft] = useState(null),
    [preview, setPreview] = useState(null),
    [filter, setFilter] = useState('');
  useEffect(() => {
    setDraft(null);
    setPreview(null);
    setFilter('');
  }, [section]);
  const save = async action => {
    if (await request(action, {
      record: draft
    }, 'Ndryshimet u ruajtën.')) setDraft(null);
  };
  if (section === 'Inventory') return <><Panel title="Inventari" copy="Stoku i shitshëm dhe rezervimet aktive. Porositë e konfirmuara zbriten nga regjistri; ky nuk është numërim fizik i magazinës."><input className="cms-filter" placeholder="Kërko SKU ose emër" aria-label="Filtro inventarin" value={filter} onChange={e => setFilter(e.target.value)} /><div className="cms-table-scroll"><table><thead><tr><th>Artikulli</th><th>SKU</th><th>Para rezervimeve</th><th>Rezervuar</th><th>Disponueshëm</th><th /></tr></thead><tbody>{(cms.inventory || []).filter(p => `${p.name} ${p.sku}`.toLowerCase().includes(filter.toLowerCase())).map(p => <tr key={p.id}><td>{p.name}</td><td>{p.sku}</td><td>{p.onHand}</td><td>{p.reserved}</td><td>{p.available}</td><td><button onClick={() => setDraft({
                  id: p.id,
                  name: p.name,
                  expectedStock: p.available,
                  delta: 0,
                  reason: '',
                  reference: ''
                })}>Korrigjo</button></td></tr>)}</tbody></table></div></Panel>{draft && <Panel title={`Korrigjo: ${draft.name}`}><form onSubmit={async e => {
        e.preventDefault();
        if (await request('stock_adjust', draft, 'Stoku u korrigjua dhe lëvizja u regjistrua.')) setDraft(null);
      }}><div className="cms-fields"><Field label="Ndryshimi (+ / −)" type="number" required value={draft.delta} onChange={e => setDraft({
            ...draft,
            delta: Number(e.target.value)
          })} /><Field label="Arsyeja" required minLength="3" value={draft.reason} onChange={e => setDraft({
            ...draft,
            reason: e.target.value
          })} /><Field label="Dokumenti / referenca" value={draft.reference} onChange={e => setDraft({
            ...draft,
            reference: e.target.value
          })} /></div><button disabled={busy || !draft.delta} className="primary">Regjistro lëvizjen</button><button type="button" onClick={() => setDraft(null)}>Anulo</button></form></Panel>}<Panel title="Lëvizjet e fundit"><div className="cms-table-scroll"><table><thead><tr><th>Koha</th><th>Produkti</th><th>Ndryshimi</th><th>Arsyeja</th><th>Përdoruesi</th></tr></thead><tbody>{(cms.movements || []).map(m => <tr key={m.id}><td>{when(m.at)}</td><td>{data.products.find(p => p.id === m.productId)?.name || m.productId}</td><td>{m.delta > 0 ? '+' : ''}{m.delta} ({m.before} → {m.after})</td><td>{m.reason}</td><td>{m.actor}</td></tr>)}</tbody></table></div>{!cms.movements?.length && <Empty>Ende pa lëvizje të regjistruara.</Empty>}</Panel></>;
  if (section === 'Rules') return <><Panel title="Rregullat e zbritjeve" copy="Produkt, porosi, Blej X merr Y dhe dërgesë. Llogaritja përfundimtare kryhet në server." action={canCms(permissions, 'marketing.write') && <button className="primary" onClick={() => setDraft({
      ...blankRule
    })}>Krijo zbritje</button>}><div className="cms-records">{(cms.rules || []).map(r => <button key={r.id} onClick={() => setDraft({
          ...r
        })}><span><strong>{r.title}</strong><small>{r.method === 'automatic' ? 'Automatike' : r.code} · {r.type}</small></span><Badge record={r} /></button>)}{!cms.rules?.length && <Empty>Nuk ka rregulla të reja. Kodet ekzistuese mbeten të disponueshme.</Empty>}</div><button onClick={() => openSection('Discounts')}>Menaxho kodet ekzistuese</button></Panel>{draft && <Panel title={draft.id ? 'Redakto zbritjen' : 'Zbritje e re'}><form onSubmit={e => {
        e.preventDefault();
        save('save_rule');
      }}><div className="cms-fields"><Field label="Emri" required value={draft.title} onChange={e => setDraft({
            ...draft,
            title: e.target.value
          })} /><Field label="Lloji"><select value={draft.type} onChange={e => setDraft({
              ...draft,
              type: e.target.value
            })}><option value="order">Ulje porosie</option><option value="product">Ulje produkti</option><option value="buyXGetY">Blej X, merr Y</option><option value="shipping">Dërgesë falas</option></select></Field><Field label="Metoda"><select value={draft.method} onChange={e => setDraft({
              ...draft,
              method: e.target.value
            })}><option value="code">Me kod</option><option value="automatic">Automatike</option></select></Field>{draft.method === 'code' && <Field label="Kodi" required value={draft.code} onChange={e => setDraft({
            ...draft,
            code: e.target.value.toUpperCase()
          })} />}</div>{draft.type !== 'shipping' && <div className="cms-fields"><Field label="Vlera"><select value={draft.valueType} onChange={e => setDraft({
              ...draft,
              valueType: e.target.value,
              value: 0
            })}><option value="percent">Përqindje</option><option value="fixed">Shumë fikse €</option></select></Field><Field label={draft.valueType === 'percent' ? 'Përqindja %' : 'Shuma €'} type="number" min="0" max={draft.valueType === 'percent' ? 100 : 1000000} step="0.01" value={draft.value / 100} onChange={e => setDraft({
            ...draft,
            value: Math.round(Number(e.target.value) * 100)
          })} /></div>}{['product', 'buyXGetY'].includes(draft.type) && <ProductSelect title="Produktet pjesëmarrëse (bosh = të gjitha)" products={data.products} value={draft.productIds} onChange={v => setDraft({
          ...draft,
          productIds: v
        })} />} {draft.type === 'buyXGetY' && <><ProductSelect title="Produktet Y — shtohen nga klienti në shportë" products={data.products} value={draft.rewardProductIds} onChange={v => setDraft({
            ...draft,
            rewardProductIds: v
          })} /><div className="cms-fields">{[['buyQuantity', 'Sasia X'], ['getQuantity', 'Sasia Y'], ['maxApplications', 'Kufi për porosi']].map(([k, t]) => <Field key={k} label={t} type="number" min="1" max="100" value={draft[k]} onChange={e => setDraft({
              ...draft,
              [k]: Number(e.target.value)
            })} />)}</div></>}<div className="cms-fields"><Field label="Blerje minimale €" type="number" min="0" step="0.01" value={draft.minimumCents / 100} onChange={e => setDraft({
            ...draft,
            minimumCents: Math.round(Number(e.target.value) * 100)
          })} /><Field label="Sasi minimale" type="number" min="0" value={draft.minimumQuantity} onChange={e => setDraft({
            ...draft,
            minimumQuantity: Number(e.target.value)
          })} /><Field label="Kufi total (0 = pa kufi)" type="number" min="0" value={draft.usageLimit} onChange={e => setDraft({
            ...draft,
            usageLimit: Number(e.target.value)
          })} /><Field label="Për llogari (0 = pa kufi)" type="number" min="0" value={draft.perCustomerLimit} onChange={e => setDraft({
            ...draft,
            perCustomerLimit: Number(e.target.value)
          })} /></div><fieldset><legend>Kombinohet me (lejimi duhet të jetë i ndërsjellë)</legend>{[['product', 'Ulje produkti'], ['order', 'Ulje porosie'], ['shipping', 'Ulje dërgese']].map(([v, t]) => <label className="cms-check" key={v}><input type="checkbox" checked={draft.combinesWith.includes(v)} onChange={e => setDraft({
              ...draft,
              combinesWith: e.target.checked ? [...draft.combinesWith, v] : draft.combinesWith.filter(x => x !== v)
            })} />{t}</label>)}</fieldset><Schedule draft={draft} setDraft={setDraft} canPublish={canCms(permissions, 'marketing.publish')} /><p className="cms-help">Orari ruhet sipas zonës së pajisjes dhe konvertohet në UTC. Maksimumi 10 rregulla të publikuara. Për kufi për klient, kërkohet llogari.</p><div className="cms-form-actions"><button className="primary" disabled={busy}>Ruaj rregullin</button><button type="button" onClick={() => setDraft(null)}>Anulo</button></div></form></Panel>}<DiscountPreview products={data.products} request={request} busy={busy} /></>;
  if (['Offers', 'Placements', 'Collections', 'Staff'].includes(section)) {
    const key = {
      Offers: 'offers',
      Placements: 'placements',
      Collections: 'collections',
      Staff: 'staff'
    }[section];
    const title = {
      Offers: 'Ofertat',
      Placements: 'Slideshow & bannerë',
      Collections: 'Koleksionet',
      Staff: 'Stafi & rolet'
    }[section];
    const defaults = section === 'Placements' ? blankPlacement : section === 'Staff' ? {
      name: '',
      email: '',
      password: '',
      role: 'catalog',
      active: true
    } : section === 'Collections' ? {
      title: '',
      mode: 'manual',
      productIds: [],
      excludeIds: [],
      tag: '',
      productType: '',
      minimumPrice: 0,
      maximumPrice: 0,
      status: 'Draft',
      startsAt: '',
      endsAt: ''
    } : {
      title: '',
      description: '',
      ruleId: '',
      owner: '',
      status: 'Draft',
      startsAt: '',
      endsAt: ''
    };
    const permission = section === 'Offers' ? 'marketing' : section === 'Collections' ? 'catalog' : section === 'Staff' ? 'staff' : 'content';
    return <><Panel title={title} copy={section === 'Placements' ? 'Publikimi dhe afatet kontrollojnë shfaqjen në website. Oferta e pezulluar fsheh bannerin e lidhur.' : section === 'Staff' ? 'Llogari të veçanta për ekipin. Ndryshimi i rolit ose çaktivizimi mbyll sesionet ekzistuese.' : undefined} action={canCms(permissions, permission + (section === 'Staff' ? '.manage' : '.write')) && <button className="primary" onClick={() => setDraft({
        ...defaults
      })}>Shto {section === 'Staff' ? 'përdorues' : 'të re'}</button>}><div className="cms-records">{(cms[key] || []).map(r => <button key={r.id} onClick={() => setDraft({
            ...defaults,
            ...r
          })}><span><strong>{r.title || r.name || r.email}</strong><small>{r.email || r.description || r.position || r.mode}</small></span>{section === 'Staff' ? <span className="cms-badge">{r.active ? r.role : 'Çaktivizuar'}</span> : <Badge record={r} />}</button>)}{!cms[key]?.length && <Empty />}</div></Panel>{draft && <Panel title={draft.id ? 'Redakto' : 'Krijo'}><form onSubmit={e => {
          e.preventDefault();
          save({
            Offers: 'save_offer',
            Placements: 'save_placement',
            Collections: 'save_collection',
            Staff: 'save_staff'
          }[section]);
        }}><Field label={section === 'Staff' ? 'Emri' : 'Titulli'} required value={draft.title ?? draft.name} onChange={e => setDraft({
            ...draft,
            [section === 'Staff' ? 'name' : 'title']: e.target.value
          })} />{section === 'Offers' && <><Field label="Përshkrimi"><textarea value={draft.description} onChange={e => setDraft({
                ...draft,
                description: e.target.value
              })} /></Field><Field label="Rregulli tregtar"><select value={draft.ruleId} onChange={e => setDraft({
                ...draft,
                ruleId: e.target.value
              })}><option value="">Ofertë editoriale pa zbritje</option>{(cms.rules || []).map(r => <option key={r.id} value={r.id}>{r.title}</option>)}</select></Field><Field label="Përgjegjësi" value={draft.owner} onChange={e => setDraft({
              ...draft,
              owner: e.target.value
            })} /></>}{section === 'Placements' && <><div className="cms-fields"><Field label="Pozicioni"><select value={draft.position} onChange={e => setDraft({
                  ...draft,
                  position: e.target.value
                })}><option value="home_banner">Slideshow në kryefaqe</option><option value="announcement">Shirit njoftimi</option></select></Field><Field label="Renditja" type="number" min="0" max="99" value={draft.order} onChange={e => setDraft({
                ...draft,
                order: Number(e.target.value)
              })} /></div><Field label="Nëntitulli" value={draft.subtitle} onChange={e => setDraft({
              ...draft,
              subtitle: e.target.value
            })} />{['image', 'mobileImage'].map((k, i) => <Field key={k} label={i ? 'Imazhi mobile (opsional)' : 'Imazhi desktop'} value={draft[k]} placeholder="/assets/brand/...webp" onChange={e => setDraft({
              ...draft,
              [k]: e.target.value
            })} />)}<Field label="Teksti alternativ" value={draft.alt} onChange={e => setDraft({
              ...draft,
              alt: e.target.value
            })} /><div className="cms-fields"><Field label="Butoni" value={draft.cta} onChange={e => setDraft({
                ...draft,
                cta: e.target.value
              })} /><Field label="Destinacioni" required value={draft.href} onChange={e => setDraft({
                ...draft,
                href: e.target.value
              })} /><Field label="Oferta"><select value={draft.offerId} onChange={e => setDraft({
                  ...draft,
                  offerId: e.target.value
                })}><option value="">Pa ofertë të lidhur</option>{(cms.offers || []).map(o => <option value={o.id} key={o.id}>{o.title}</option>)}</select></Field></div>{draft.image && /^\/(assets|uploads)\//.test(draft.image) && <div className="cms-banner-preview"><img src={draft.image} alt={draft.alt} /><div><strong>{draft.title}</strong><p>{draft.subtitle}</p><span>{draft.cta}</span></div></div>}</>}{section === 'Collections' && <><Field label="Anëtarësia"><select value={draft.mode} onChange={e => setDraft({
                ...draft,
                mode: e.target.value
              })}><option value="manual">Përzgjedhje manuale</option><option value="dynamic">Kushte dinamike (të gjitha)</option></select></Field>{draft.mode === 'manual' ? <ProductSelect title="Produktet" products={data.products} value={draft.productIds} onChange={v => setDraft({
              ...draft,
              productIds: v
            })} /> : <div className="cms-fields"><Field label="Etiketa" value={draft.tag} onChange={e => setDraft({
                ...draft,
                tag: e.target.value
              })} /><Field label="Lloji"><select value={draft.productType} onChange={e => setDraft({
                  ...draft,
                  productType: e.target.value
                })}><option value="">Të gjitha</option><option>Sunglasses</option><option>Prescription Glasses</option></select></Field><Field label="Çmimi minimal €" type="number" min="0" value={draft.minimumPrice} onChange={e => setDraft({
                ...draft,
                minimumPrice: Number(e.target.value)
              })} /><Field label="Çmimi maksimal € (0 = pa kufi)" type="number" min="0" value={draft.maximumPrice} onChange={e => setDraft({
                ...draft,
                maximumPrice: Number(e.target.value)
              })} /></div>}</>}{section === 'Staff' && <><Field label="Emaili" type="email" required autoComplete="off" value={draft.email} onChange={e => setDraft({
              ...draft,
              email: e.target.value
            })} /><Field label={draft.id ? 'Fjalëkalim i ri (bosh = pa ndryshim)' : 'Fjalëkalimi fillestar'} type="password" required={!draft.id} minLength="12" autoComplete="new-password" value={draft.password || ''} onChange={e => setDraft({
              ...draft,
              password: e.target.value
            })} /><Field label="Roli"><select value={draft.role} onChange={e => setDraft({
                ...draft,
                role: e.target.value
              })}>{Object.keys(cms.roles || {}).filter(r => r !== 'owner').map(r => <option key={r}>{r}</option>)}</select></Field><label className="cms-check"><input type="checkbox" checked={draft.active} onChange={e => setDraft({
                ...draft,
                active: e.target.checked
              })} />Llogaria aktive</label><p className="cms-help">Lejet: {(cms.roles?.[draft.role] || []).join(' · ')}</p></>}{section !== 'Staff' && <Schedule draft={draft} setDraft={setDraft} canPublish={canCms(permissions, permission + '.publish')} />}<div className="cms-form-actions"><button className="primary" disabled={busy}>Ruaj</button><button type="button" onClick={() => setDraft(null)}>Anulo</button></div></form></Panel>}</>;
  }
  if (section === 'Revisions') return <Panel title="Versionet e përmbajtjes" copy="Rikthimi ruan versionin aktual në histori dhe publikon përmbajtjen e zgjedhur."><div className="cms-records">{(cms.revisions || []).map(r => <article key={r.id}><span><strong>{when(r.at)}</strong><small>{r.actor} · {r.id}</small></span><button disabled={busy || !canCms(permissions, 'content.publish')} onClick={() => request('restore_content', {
          id: r.id
        }, 'Versioni u rikthye.', true)}>Rikthe versionin</button></article>)}{!cms.revisions?.length && <Empty>Historia krijohet kur publikohet përmbajtja.</Empty>}</div></Panel>;
  if (section === 'Integrations') return <Panel title="Integrimet" copy="Shërbimet dhe kufijtë aktualë të instalimit."><div className="cms-integration-grid">{[['Online Store', 'Aktiv', 'Katalog, kërkesa porosie, llogari dhe CMS.'], ['Pagesat online', 'Kërkon konfigurim', 'Porositë konfirmohen nga ekipi. Procesori i pagesës lidhet dhe testohet veçmas.'], ['Dërgesat', 'Menaxhim nga stafi', 'Metoda e dërgesës dhe kodi i gjurmimit ruhen në porosi. Nuk ka sinkronizim me korrier.'], ['Email', 'Verifikoni dorëzimin', 'Statusi i tentativës ruhet në porosi. Pranimi në inbox duhet kontrolluar.'], ['SMS / WhatsApp', 'Pa ofrues automatik', 'Faqja mund të hapë kontaktin; nuk pretendon dërgim automatik.'], ['Inventari', 'Një lokacion', 'Rezervime porosish dhe lëvizje stoku në lokacionin kryesor.']].map(([a, b, c]) => <article key={a}><h3>{a}</h3><span className="cms-badge">{b}</span><p>{c}</p></article>)}</div></Panel>;
  return null;
}
function DiscountPreview({
  products,
  request,
  busy
}) {
  const [items, setItems] = useState([]),
    [code, setCode] = useState(''),
    [shipping, setShipping] = useState(0),
    [result, setResult] = useState(null);
  return <Panel title="Provo me shportë shembull" copy="Parapamje e rregullave të ruajtura; nuk krijon porosi dhe nuk rezervon stok."><form onSubmit={async e => {
      e.preventDefault();
      const r = await request('discount_preview', {
        items,
        codes: code.split(',').map(s => s.trim()).filter(Boolean),
        shippingCents: Math.round(shipping * 100)
      });
      if (r) setResult(r.preview);
    }}><ProductSelect title="Artikujt në shportën e provës" products={products} value={items.map(i => i.productId)} onChange={v => setItems(v.map(productId => ({
        productId,
        quantity: items.find(i => i.productId === productId)?.quantity || 1
      })))} /><div className="cms-fields">{items.map(item => <Field key={item.productId} label={`Sasia · ${products.find(p => p.id === item.productId)?.name || item.productId}`} type="number" min="1" max="100" value={item.quantity} onChange={e => setItems(items.map(i => i.productId === item.productId ? {...i, quantity: Math.max(1, Math.min(100, Number(e.target.value) || 1))} : i))} />)}</div><div className="cms-fields"><Field label="Kodet (të ndara me presje)" value={code} onChange={e => setCode(e.target.value.toUpperCase())} /><Field label="Dërgesa €" type="number" min="0" step="0.01" value={shipping} onChange={e => setShipping(Number(e.target.value))} /></div><button disabled={busy || !items.length}>Llogarit parapamjen</button></form>{result && <div className="cms-quote-result" role="status"><strong>Totali: {euro(result.totalCents / 100)}</strong><p>Ulje artikujsh: {euro(result.discountCents / 100)} · ulje dërgese: {euro(result.shippingDiscountCents / 100)}</p>{Object.entries(result.reasons || {}).map(([id, t]) => <p key={id}>{t}</p>)}</div>}</Panel>;
}
