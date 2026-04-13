const $ = (s) => document.querySelector(s);
let selectedRows = [];

async function j(url, opt) {
  const r = await fetch(url, { headers: { "content-type": "application/json" }, ...opt });
  if (r.status === 204) return {};
  return r.json();
}

async function refreshServers() {
  const { servers } = await j('/api/servers');
  const sel = $('#server-select');
  sel.innerHTML = servers.map(s => `<option value="${s.id}">${s.name} (${s.envTag||'n/a'})</option>`).join('');
}

$('#server-form').onsubmit = async (e) => {
  e.preventDefault();
  const fd = new FormData(e.target);
  const payload = Object.fromEntries(fd.entries());
  payload.port = Number(payload.port || 5432);
  payload.ssl = fd.get('ssl') === 'on';
  const id = $('#server-select').value;
  if (id) await j(`/api/servers/${id}`, { method: 'PUT', body: JSON.stringify(payload) });
  else await j('/api/servers', { method: 'POST', body: JSON.stringify(payload) });
  await refreshServers();
};

$('#test-server').onclick = async () => alert(JSON.stringify(await j(`/api/servers/${$('#server-select').value}/test`, { method: 'POST' })));
$('#delete-server').onclick = async () => { await j(`/api/servers/${$('#server-select').value}`, { method: 'DELETE' }); refreshServers(); };

$('#load-meta').onclick = async () => {
  const s = $('#server-select').value;
  const meta = await j(`/api/servers/${s}/metadata`);
  $('#tree').textContent = JSON.stringify(meta, null, 2);
};

$('#load-table').onclick = async () => {
  const s = $('#server-select').value;
  const schema = $('#schema').value;
  const table = $('#table').value;
  const filter = encodeURIComponent($('#filter').value);
  const out = await j(`/api/servers/${s}/table-data?schema=${schema}&table=${table}&page=1&pageSize=25&filter=${filter}`);
  const pks = out.primaryKeys || [];
  const cols = out.rows[0] ? Object.keys(out.rows[0]) : [];
  $('#table-wrap').innerHTML = `<div>total: ${out.total}, PK: ${pks.join(',')}</div><table><thead><tr><th>sel</th>${cols.map(c=>`<th>${c}</th>`).join('')}</tr></thead><tbody>${out.rows.map((r,i)=>`<tr><td><input type='checkbox' data-i='${i}'/></td>${cols.map(c=>`<td contenteditable='true' data-c='${c}' data-i='${i}'>${r[c]??''}</td>`).join('')}</tr>`).join('')}</tbody></table><button id='insert-row'>Insert Empty</button> <button id='save-first'>Update First Selected</button> <button id='delete-first'>Delete First Selected</button>`;
  selectedRows = [];
  $('#table-wrap').querySelectorAll("input[type='checkbox']").forEach(cb => cb.onchange = () => {
    const idx = Number(cb.dataset.i);
    if (cb.checked) selectedRows.push(out.rows[idx]); else selectedRows = selectedRows.filter(x=>x!==out.rows[idx]);
  });
  $('#insert-row').onclick = async () => {
    const values = Object.fromEntries(cols.map(c=>[c,null]));
    alert(JSON.stringify(await j(`/api/servers/${s}/table-data/${schema}/${table}`, {method:'POST',body:JSON.stringify({values})})));
  };
  $('#save-first').onclick = async () => {
    const row = selectedRows[0]; if(!row) return alert('select row');
    const edited = {...row};
    $('#table-wrap').querySelectorAll("td[contenteditable='true']").forEach(td=>{ if(Number(td.dataset.i)===0) edited[td.dataset.c]=td.textContent; });
    alert(JSON.stringify(await j(`/api/servers/${s}/table-data/${schema}/${table}`, {method:'PATCH',body:JSON.stringify({primaryKeys:pks,keyValues:row,values:edited})})));
  };
  $('#delete-first').onclick = async () => {
    const row = selectedRows[0]; if(!row) return alert('select row');
    if(confirm('Delete selected row?')) alert(JSON.stringify(await j(`/api/servers/${s}/table-data/${schema}/${table}`, {method:'DELETE',body:JSON.stringify({primaryKeys:pks,rows:[row]})})));
  };
  $('#bulk-delete').onclick = async () => {
    if(!selectedRows.length) return alert('select rows');
    if(confirm(`Delete ${selectedRows.length} rows?`)) alert(JSON.stringify(await j(`/api/servers/${s}/table-data/${schema}/${table}`, {method:'DELETE',body:JSON.stringify({primaryKeys:pks,rows:selectedRows})})));
  };
};

$('#run-sql').onclick = async () => {
  const s = $('#server-select').value;
  const out = await j(`/api/servers/${s}/sql`, { method: 'POST', body: JSON.stringify({ sql: $('#sql').value }) });
  $('#sql-result').textContent = JSON.stringify(out, null, 2);
  $('#history').textContent = JSON.stringify((await j(`/api/servers/${s}/sql/history`)).history, null, 2);
  $('#snippets').textContent = JSON.stringify((await j(`/api/servers/${s}/sql/snippets`)).snippets, null, 2);
};
$('#save-snippet').onclick = async () => {
  const s = $('#server-select').value;
  await j(`/api/servers/${s}/sql/snippets`, { method: 'POST', body: JSON.stringify({ name: $('#snippet-name').value || 'snippet', sql: $('#sql').value }) });
  $('#snippets').textContent = JSON.stringify((await j(`/api/servers/${s}/sql/snippets`)).snippets, null, 2);
};

$('#refresh-roles').onclick = async () => {
  const s = $('#server-select').value;
  $('#roles').textContent = JSON.stringify((await j(`/api/servers/${s}/roles`)).roles, null, 2);
};
$('#create-role').onclick = async () => {
  const s = $('#server-select').value;
  alert(JSON.stringify(await j(`/api/servers/${s}/roles`, {method:'POST',body:JSON.stringify({name:$('#role-name').value,password:$('#role-pass').value||undefined})})));
};
$('#grant').onclick = async () => {
  const s = $('#server-select').value;
  alert(JSON.stringify(await j(`/api/servers/${s}/roles/grant`, {method:'POST',body:JSON.stringify({role:$('#grant-role').value,grantee:$('#grant-to').value})})));
};
$('#backup').onclick = async () => {
  const s = $('#server-select').value;
  $('#backup-out').textContent = JSON.stringify(await j(`/api/servers/${s}/backup`, {method:'POST'}), null, 2);
};

refreshServers();
