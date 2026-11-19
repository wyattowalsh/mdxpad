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

  it('drops a parent path from an svg image and keeps a document link', () => {
    expect(sanitizeExportedTag('<image href="../secret.png">')).toBe('<image>');
    expect(sanitizeExportedTag('<image href="./pixel.png">')).toBe('<image href="./pixel.png">');
    expect(sanitizeExportedHtml('<a href="../notes/a.md">Notes</a>')).toContain(
      'href="../notes/a.md"'
    );
  });
});
