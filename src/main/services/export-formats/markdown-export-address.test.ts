import { describe, expect, it } from 'vitest';

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
