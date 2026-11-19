import { describe, expect, it } from 'vitest';

import { markdownToPdfHtml } from './pdf-exporter';
import { sanitizeExportedHtml, sanitizeExportedTag } from './markdown-export-address';

describe('sanitizeExportedHtml', () => {
  it('keeps alignment and drops a local file inside a style', () => {
    const aligned = sanitizeExportedHtml('<td style="text-align: right">2</td>');
    expect(aligned).toContain('style="text-align: right"');

    const local = sanitizeExportedHtml(
      '<div style="background:url(file:///etc/passwd);color:red"></div>'
    );
    expect(local).not.toContain('file:');
    expect(local).toContain('background:none');
    expect(local).toContain('color:red');

    const remote = sanitizeExportedHtml(
      '<div style="background:url(https://example.com/a.png)"></div>'
    );
    expect(remote).toContain('https://example.com/a.png');
  });

  it('drops a local file from a style sheet and keeps a remote import', () => {
    const local = sanitizeExportedHtml(
      '<style>body{background:url(file:///etc/passwd);color:red} @import "file:///etc/passwd.css";</style>'
    );
    expect(local).not.toContain('file:');
    expect(local).toContain('background:none');
    expect(local).toContain('color:red');
    expect(local).not.toContain('@import');

    const remote = sanitizeExportedHtml(
      '<style>@import "https://example.com/a.css"; h1{color:red}</style>'
    );
    expect(remote).toContain('https://example.com/a.css');
    expect(remote).toContain('color:red');
  });

  it('drops a local file hidden by a css escape', () => {
    const styled = sanitizeExportedHtml(
      '<div style="background:url(\\66ile:///etc/passwd);color:red"></div>'
    );
    expect(styled).not.toContain('file:');
    expect(styled).toContain('background:none');
    expect(styled).toContain('color:red');

    const imported = sanitizeExportedHtml('<style>@import "\\66ile:///etc/passwd.css";</style>');
    expect(imported).not.toContain('file:');
    expect(imported).not.toContain('@import');
  });

  it('drops a file hidden by a numeric reference without a semicolon', () => {
    const link = sanitizeExportedHtml('<a href="&#106avascript:alert(1)">Run</a>');
    expect(link).toBe('<a>Run</a>');
    const picture = sanitizeExportedHtml('<img src="&#102ile:///etc/passwd.png">');
    expect(picture).toBe('<img>');
    const styled = sanitizeExportedHtml(
      '<div style="background:url(&#102ile:///etc/passwd);color:red"></div>'
    );
    expect(styled).not.toContain('file:');
    expect(styled).not.toContain('&#102');
    expect(styled).toContain('color:red');
    const set = sanitizeExportedHtml(
      '<style>body{background:image-set("file:///etc/passwd" 1x);color:red}</style>'
    );
    expect(set).not.toContain('file:');
    expect(set).toContain('color:red');
    const remote = sanitizeExportedHtml(
      '<style>body{background:image-set("https://example.com/a.png" 1x)}</style>'
    );
    expect(remote).toContain('https://example.com/a.png');
  });

  it('drops a file written after a slash and an escaped css function', () => {
    expect(sanitizeExportedHtml('<img /src="file:///etc/passwd" alt="x">')).toBe(
      '<img alt="x">'
    );
    expect(sanitizeExportedHtml('<a/href="javascript:alert(1)">Run</a>')).toBe('<a>Run</a>');
    const styled = sanitizeExportedHtml(
      '<div style="background:IMAGE-SET(\'file:///etc/passwd\' 1x);color:red">x</div>'
    );
    expect(styled).not.toContain('file:');
    expect(styled).toContain('color:red');
    const escaped = sanitizeExportedHtml(
      '<div style="background:\\75rl(file:///etc/passwd);color:red">x</div>'
    );
    expect(escaped).not.toContain('file:');
    expect(escaped).toContain('color:red');
    const imported = sanitizeExportedHtml('<style>@\\69 mport "file:///etc/passwd.css";</style>');
    expect(imported).not.toContain('file:');
    expect(sanitizeExportedTag('<filter href="../secret.svg">')).toBe('<filter>');
    expect(sanitizeExportedTag('<mask href="../secret.svg">')).toBe('<mask>');
    expect(sanitizeExportedTag('<clipPath href="../secret.svg">')).toBe('<clipPath>');
    expect(sanitizeExportedTag('<animate href="../secret.svg">')).toBe('<animate>');
    expect(sanitizeExportedTag('<set href="../secret.svg">')).toBe('<set>');
    expect(sanitizeExportedHtml('<button formaction="../secret.md">Go</button>')).toBe(
      '<button>Go</button>'
    );
    expect(sanitizeExportedHtml('<a href="../notes/a.md">Notes</a>')).toContain(
      'href="../notes/a.md"'
    );
  });

  it('drops a local file from an svg paint attribute', () => {
    expect(sanitizeExportedHtml('<svg><rect filter="url(../secret.svg#a)" /></svg>')).toBe(
      '<svg><rect /></svg>'
    );
    expect(sanitizeExportedHtml('<svg><rect filter="url(file:///etc/passwd)" /></svg>')).not.toContain(
      'file:'
    );
    expect(sanitizeExportedHtml('<svg><rect fill="url(#local)" /></svg>')).toContain('url(#local)');
    expect(sanitizeExportedHtml('<svg><rect fill="red" /></svg>')).toContain('fill="red"');
    expect(sanitizeExportedHtml('<svg><rect clip-path="url(../secret.svg)" /></svg>')).not.toContain(
      'secret'
    );
    expect(
      sanitizeExportedHtml('<svg><rect marker-start="url(../secret.svg#m)" /></svg>')
    ).not.toContain('secret');
    expect(sanitizeExportedHtml('<svg><rect filter="\\75rl(file:///etc/passwd)" /></svg>')).not.toContain(
      'file:'
    );
    expect(sanitizeExportedHtml('<svg><rect fill="url(https://example.com/a.svg#g)" /></svg>')).toContain(
      'https://example.com/a.svg'
    );
    expect(sanitizeExportedHtml('<svg><rect filter=url(../secret.svg#a) /></svg>')).not.toContain(
      'secret'
    );
  });

  it('drops a file hidden in an svg data image', () => {
    const icon = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"></svg>').toString('base64');
    const iconUri = `data:image/svg+xml;base64,${icon}`;
    expect(sanitizeExportedHtml(`<img src="${iconUri}" alt="icon">`)).toContain('svg+xml');
    expect(markdownToPdfHtml(`![Icon](${iconUri})\n`)).toContain('svg+xml');

    const fileSvg = Buffer.from('<svg><image href="file:///etc/passwd"/></svg>').toString('base64');
    const fileUri = `data:image/svg+xml;base64,${fileSvg}`;
    expect(sanitizeExportedHtml(`<img src="${fileUri}" alt="x">`)).toBe('<img alt="x">');
    const pdf = markdownToPdfHtml(`![Secret](${fileUri})\n`);
    expect(pdf).not.toContain('passwd');
    expect(pdf).not.toContain('file:');

    const encoded = `data:image/svg+xml,${encodeURIComponent('<svg><image href="file:///etc/passwd"/></svg>')}`;
    expect(sanitizeExportedHtml(`<img src="${encoded}" alt="x">`)).not.toContain('passwd');
    expect(sanitizeExportedHtml('<img src="data:image/png;base64,aaaa" alt="x">')).toContain(
      'data:image/png;base64,aaaa'
    );
    const parent = Buffer.from('<svg><rect filter="url(../secret.svg)"/></svg>').toString('base64');
    expect(sanitizeExportedHtml(`<img src="data:image/svg+xml;base64,${parent}" alt="x">`)).toBe(
      '<img alt="x">'
    );
  });

  it('drops an event handler from exported html', () => {
    const image = sanitizeExportedHtml(
      '<img src="https://example.com/a.png" onerror="alert(1)" alt="x">'
    );
    expect(image).not.toContain('onerror');
    expect(image).not.toContain('alert');
    expect(image).toContain('https://example.com/a.png');
    expect(image).toContain('alt="x"');
    const link = sanitizeExportedHtml(
      '<a href="https://example.com" onclick="location=\'file:///etc/passwd\'">Go</a>'
    );
    expect(link).not.toContain('onclick');
    expect(link).toContain('href="https://example.com"');
    expect(
      markdownToPdfHtml('<img src="https://example.com/a.png" onerror="alert(1)" alt="x">')
    ).not.toContain('onerror');
  });

  it('drops a local file from a css src function', () => {
    const font = sanitizeExportedHtml(
      '<style>@font-face{font-family:x;src:src("../secret.woff")}</style>'
    );
    expect(font).not.toContain('secret');
    expect(font).toContain('font-family:x');
    const disk = sanitizeExportedHtml(
      '<style>@font-face{font-family:x;src:src("file:///etc/passwd")}</style>'
    );
    expect(disk).not.toContain('file:');
    const escaped = sanitizeExportedHtml(
      '<style>@font-face{font-family:x;src:\\73 rc("../secret.woff")}</style>'
    );
    expect(escaped).not.toContain('secret');
    const remote = sanitizeExportedHtml(
      '<style>@font-face{font-family:x;src:src("https://example.com/a.woff")}</style>'
    );
    expect(remote).toContain('https://example.com/a.woff');
    const painted = sanitizeExportedHtml(
      '<div style="background:src(\'../secret.png\');color:red">x</div>'
    );
    expect(painted).not.toContain('secret');
    expect(painted).toContain('color:red');
  });

  it('drops a local file from an animation value and a ping', () => {
    expect(sanitizeExportedHtml('<animate attributeName="href" to="file:///etc/passwd">')).toBe(
      '<animate attributeName="href">'
    );
    expect(sanitizeExportedHtml('<set attributeName="href" to="../secret.svg">')).toBe(
      '<set attributeName="href">'
    );
    expect(sanitizeExportedHtml('<animate attributeName="filter" to="url(../secret.svg)">')).toBe(
      '<animate attributeName="filter">'
    );
    expect(sanitizeExportedHtml('<animate attributeName="width" to="100">')).toContain('to="100"');
    expect(sanitizeExportedHtml('<animate attributeName="fill" to="url(#local)">')).toContain(
      'url(#local)'
    );
    expect(sanitizeExportedHtml('<set attributeName="href" to="./ok.svg">')).toContain('./ok.svg');
    const ping = sanitizeExportedHtml(
      '<a ping="file:///etc/passwd https://example.com/t" href="https://example.com">x</a>'
    );
    expect(ping).not.toContain('file:');
    expect(ping).toContain('https://example.com/t');
    expect(sanitizeExportedHtml('<a ping="../secret" href="https://example.com">x</a>')).not.toContain(
      'ping='
    );
    expect(sanitizeExportedHtml('<img longdesc="file:///etc/passwd" alt="x">')).toBe(
      '<img alt="x">'
    );
    expect(sanitizeExportedHtml('<img longdesc="../notes/a.md" alt="x">')).toContain(
      'longdesc="../notes/a.md"'
    );
  });

  it('drops a local file from an image source set', () => {
    expect(
      sanitizeExportedHtml(
        '<img imagesrcset="file:///etc/passwd 1x, https://example.com/a.png 2x" alt="x">'
      )
    ).not.toContain('file:');
    expect(sanitizeExportedHtml('<img imagesrcset="../secret.png 1x" alt="x">')).not.toContain(
      'secret'
    );
    expect(sanitizeExportedHtml('<img imagesrcset="./pixel.png 2x" alt="x">')).toContain(
      './pixel.png'
    );
    expect(sanitizeExportedHtml('<img imagesrcset="https://example.com/a.png 2x" alt="x">')).toContain(
      'https://example.com/a.png'
    );
  });

  it('drops a parent path from an svg image and keeps a document link', () => {
    expect(sanitizeExportedTag('<image href="../secret.png">')).toBe('<image>');
    expect(sanitizeExportedTag('<feImage href="../secret.png">')).toBe('<feImage>');
    expect(sanitizeExportedTag('<image href="./pixel.png">')).toBe('<image href="./pixel.png">');
    expect(sanitizeExportedHtml('<a href="../notes/a.md">Notes</a>')).toContain(
      'href="../notes/a.md"'
    );
  });
});
