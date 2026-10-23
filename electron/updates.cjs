const parse = (v) => /^v?(\d+)\.(\d+)\.(\d+)$/.exec(v)?.slice(1).map(Number);
const compare = (a, b) => {
  for (let i = 0; i < 3; i++) if (a[i] !== b[i]) return a[i] - b[i];
  return 0;
};
function selectUpdate(releases, current, platform, arch) {
  const installed = parse(current);
  if (!installed || !Array.isArray(releases))
    throw Error("Invalid version data");
  const suffix =
    platform === "darwin"
      ? `-mac-${arch}.dmg`
      : platform === "win32"
        ? `-win-${arch}.exe`
        : null;
  const candidates = releases
    .filter((r) => !r.draft && parse(r.tag_name))
    .sort((a, b) => compare(parse(b.tag_name), parse(a.tag_name)));
  for (const r of candidates) {
    if (compare(parse(r.tag_name), installed) <= 0) continue;
    const asset = r.assets?.find(
      (a) => suffix && a.name.endsWith(suffix) && a.state === "uploaded",
    );
    if (!asset) continue;
    const url = new URL(asset.browser_download_url);
    if (
      url.origin !== "https://github.com" ||
      !url.pathname.startsWith(
        "/efter-dash/glass-recorder/releases/download/",
      ) ||
      url.username ||
      url.password
    )
      continue;
    return { version: r.tag_name, url: url.href };
  }
  return { version: current, url: null };
}
module.exports = { selectUpdate };
