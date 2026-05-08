/* ================================================================
   2. API MICROSOFT GRAPH — FONCTIONS D'ACCÈS SHAREPOINT
   ================================================================ */
async function graphFetch(path, method = 'GET', body = null, extraHeaders = {}) {
  const url = path.startsWith("https://") ? path : `https://graph.microsoft.com/v1.0${path}`;

  const makeOpts = () => ({
    method,
    headers: {
      Authorization: `Bearer ${graphToken}`,
      "Content-Type": "application/json",
      ...extraHeaders
    },
    ...(body && method !== 'GET' && method !== 'DELETE' ? { body: JSON.stringify(body) } : {})
  });

  let resp = await fetch(url, makeOpts());

  // Si le jeton a expiré (401), le renouveler silencieusement et réessayer une fois
  if (resp.status === 401 && msalInstance && currentAccount) {
    try {
      await acquireToken();
      resp = await fetch(url, makeOpts());
    } catch(e) {
      throw new Error('Session expirée — veuillez recharger la page.');
    }
  }

  if (method === 'DELETE') return resp.ok ? {} : (() => { throw new Error('Delete failed ' + resp.status); })();
  if (!resp.ok) throw new Error(`Graph API error ${resp.status}: ${await resp.text()}`);
  return resp.json();
}

async function getSiteId() {
  const data = await graphFetch(`/sites/${SP_CONFIG.tenantDomain}:${SP_CONFIG.siteRelativeUrl}`);
  return data.id;
}

async function getListItems(listName) {
  const data = await graphFetch(
    `/sites/${spSiteId}/lists/${listName}/items?expand=fields($select=*)&$top=500`
  );
  // Conserver l'ID SharePoint de l'item (_spId) pour permettre les mises à jour ultérieures
  return data.value.map(item => ({ ...item.fields, _spId: item.id }));
}
