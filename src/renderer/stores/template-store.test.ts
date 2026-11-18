import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { Template, TemplateMetadata } from '@shared/contracts/template-schemas';
import { useTemplateStore } from './template-store';

const templateApi = {
  list: vi.fn(),
  get: vi.fn(),
  save: vi.fn(),
};

function metadata(id: string, name: string): TemplateMetadata {
  return {
    id,
    name,
    description: `${name} description`,
    category: 'notes',
    tags: [],
    isBuiltIn: true,
  };
}

function template(id: string, name: string): Template {
  return {
    ...metadata(id, name),
    version: '1.0.0',
    content: `# ${name}`,
    variables: [],
    createdAt: new Date('2026-02-20T10:00:00.000Z'),
    updatedAt: new Date('2026-02-20T10:00:00.000Z'),
    filePath: `/templates/${id}.mdxt`,
  };
}

describe('useTemplateStore', () => {
  beforeEach(() => {
    useTemplateStore.getState().reset();
    templateApi.list.mockReset();
    templateApi.get.mockReset();
    templateApi.save.mockReset();
    Object.assign(window, { mdxpad: { template: templateApi } });
  });

  it('keeps the template list that was requested last', async () => {
    const newer = metadata('newer', 'Newer');
    let finishOld: (value: { success: false; error: string }) => void = () => undefined;
    let finishNew: (value: { success: true; data: TemplateMetadata[] }) => void = () => undefined;
    templateApi.list
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            finishOld = resolve;
          })
      )
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            finishNew = resolve;
          })
      );

    const first = useTemplateStore.getState().loadTemplates();
    const second = useTemplateStore.getState().loadTemplates();
    finishOld({ success: false, error: 'Old list failed' });
    await first;

    expect(useTemplateStore.getState().isLoading).toBe(true);
    expect(useTemplateStore.getState().error).toBeNull();

    finishNew({ success: true, data: [newer] });
    await second;
    expect(useTemplateStore.getState().templates.map((item) => item.id)).toEqual(['newer']);
    expect(useTemplateStore.getState().isLoading).toBe(false);
    expect(useTemplateStore.getState().error).toBeNull();
  });

  it('keeps the template that was selected last', async () => {
    const selected = template('newer', 'Newer');
    let finishOld: (value: { success: false; error: string }) => void = () => undefined;
    let finishNew: (value: { success: true; data: Template }) => void = () => undefined;
    templateApi.get
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            finishOld = resolve;
          })
      )
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            finishNew = resolve;
          })
      );

    const first = useTemplateStore.getState().selectTemplate('older');
    const second = useTemplateStore.getState().selectTemplate('newer');
    finishOld({ success: false, error: 'Missing older template' });
    await first;

    expect(useTemplateStore.getState().selectedId).toBe('newer');
    expect(useTemplateStore.getState().isLoading).toBe(true);
    expect(useTemplateStore.getState().error).toBeNull();

    finishNew({ success: true, data: selected });
    await second;
    expect(useTemplateStore.getState().selectedTemplate?.id).toBe('newer');
    expect(useTemplateStore.getState().isLoading).toBe(false);
    expect(useTemplateStore.getState().error).toBeNull();
  });

  it('keeps a newer template list loading when an older save fails', async () => {
    let finishSave: (value: { success: false; error: string }) => void = () => undefined;
    let finishList: (value: { success: true; data: TemplateMetadata[] }) => void = () => undefined;
    templateApi.save.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finishSave = resolve;
        })
    );
    templateApi.list.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finishList = resolve;
        })
    );

    const saving = useTemplateStore.getState().saveTemplate({
      name: 'Notes',
      description: 'A note',
      category: 'notes',
      content: '# Notes',
    });
    const loading = useTemplateStore.getState().loadTemplates();
    finishSave({ success: false, error: 'Save failed' });
    await saving;

    expect(useTemplateStore.getState().isLoading).toBe(true);
    expect(useTemplateStore.getState().error).toBeNull();

    finishList({ success: true, data: [metadata('listed', 'Listed')] });
    await loading;
    expect(useTemplateStore.getState().templates.map((item) => item.id)).toEqual(['listed']);
    expect(useTemplateStore.getState().isLoading).toBe(false);
  });
});
