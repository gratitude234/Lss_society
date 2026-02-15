// supabase-config.js
// Public settings for Supabase (Storage public bucket + REST reads)
//
// NOTE: This is safe to ship (anon/publishable key). Do NOT put service_role keys in frontend.

window.__SUPABASE__ = {
  url: "https://cdpemaiaeskcievudfdl.supabase.co",
  anonKey: "sb_publishable_03rJ7peUsJ-4UzKVrYL_QA_D5sA6qlv",
  bucket: "pastquestions",
};

window.__supabaseHeaders__ = function() {
  const cfg = window.__SUPABASE__ || {};
  return {
    apikey: cfg.anonKey,
    Authorization: `Bearer ${cfg.anonKey}`,
    "Content-Type": "application/json",
  };
};

window.__supabasePublicFileUrl__ = function(filePath) {
  const cfg = window.__SUPABASE__ || {};
  if (!filePath) return "";
  // encodeURI keeps slashes for folders, while encoding spaces etc.
  return `${cfg.url}/storage/v1/object/public/${cfg.bucket}/${encodeURI(filePath)}`;
};

window.__supabaseForceDownloadUrl__ = function(url) {
  if (!url) return "";
  // Prefer Supabase's download hint. Keep existing querystring if present.
  return url.includes("?") ? `${url}&download=1` : `${url}?download=1`;
};
