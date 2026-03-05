import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { ProviderConfig } from '@shared/ai/types';

import { ProviderForm } from './ProviderForm';

describe('ProviderForm', () => {
  it('defaults new providers to Ollama local setup', () => {
    render(<ProviderForm onSubmit={vi.fn().mockResolvedValue(undefined)} onCancel={vi.fn()} />);

    const providerType = screen.getByLabelText<HTMLSelectElement>('Provider Type');
    const baseUrl = screen.getByLabelText<HTMLInputElement>('Base URL');

    expect(providerType.value).toBe('ollama');
    expect(baseUrl.value).toBe('http://localhost:11434');
  });

  it('prioritizes local providers in provider type order', () => {
    render(<ProviderForm onSubmit={vi.fn().mockResolvedValue(undefined)} onCancel={vi.fn()} />);

    const providerType = screen.getByLabelText<HTMLSelectElement>('Provider Type');
    const optionValues = Array.from(providerType.options, (option) => option.value);

    expect(optionValues.slice(0, 2)).toEqual(['ollama', 'lmstudio']);
  });

  it('shows llama.cpp-compatible fallback guidance for local setup', () => {
    render(<ProviderForm onSubmit={vi.fn().mockResolvedValue(undefined)} onCancel={vi.fn()} />);

    expect(
      screen.getByText(/for llama\.cpp-compatible servers, use openai compatible/i)
    ).toBeTruthy();
  });

  it('shows sidecar configuration fields when sidecar provider is selected', () => {
    render(<ProviderForm onSubmit={vi.fn().mockResolvedValue(undefined)} onCancel={vi.fn()} />);

    const providerType = screen.getByLabelText<HTMLSelectElement>('Provider Type');
    fireEvent.change(providerType, { target: { value: 'sidecar' } });

    expect(screen.getByLabelText('Model Path')).toBeTruthy();
    expect(screen.queryByLabelText('Base URL')).toBeNull();
  });

  it('requires model path before sidecar form is valid', () => {
    render(<ProviderForm onSubmit={vi.fn().mockResolvedValue(undefined)} onCancel={vi.fn()} />);

    fireEvent.change(screen.getByLabelText('Display Name'), { target: { value: 'Local Sidecar' } });
    fireEvent.change(screen.getByLabelText<HTMLSelectElement>('Provider Type'), {
      target: { value: 'sidecar' },
    });

    const modelPath = screen.getByLabelText<HTMLInputElement>('Model Path');
    const form = screen.getByRole('button', { name: 'Add Provider' }).closest('form');

    expect(modelPath.required).toBe(true);
    expect(form?.checkValidity()).toBe(false);

    fireEvent.change(modelPath, { target: { value: '/models/llama.gguf' } });
    expect(form?.checkValidity()).toBe(true);
  });

  it('submits sidecar configuration with runtime knobs', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(<ProviderForm onSubmit={onSubmit} onCancel={vi.fn()} />);

    fireEvent.change(screen.getByLabelText('Display Name'), { target: { value: 'Local Sidecar' } });
    fireEvent.change(screen.getByLabelText<HTMLSelectElement>('Provider Type'), {
      target: { value: 'sidecar' },
    });
    fireEvent.change(screen.getByLabelText('Model Path'), {
      target: { value: '/models/llama.gguf' },
    });
    fireEvent.change(screen.getByLabelText('Context Size'), { target: { value: '8192' } });
    fireEvent.change(screen.getByLabelText('GPU Layers'), { target: { value: '32' } });
    fireEvent.change(screen.getByLabelText('Threads'), { target: { value: '8' } });
    fireEvent.change(screen.getByLabelText('Port'), { target: { value: '11470' } });

    fireEvent.click(screen.getByRole('button', { name: 'Add Provider' }));

    await waitFor(() =>
      expect(onSubmit).toHaveBeenCalledWith(
        {
          displayName: 'Local Sidecar',
          type: 'sidecar',
          sidecarConfig: {
            modelPath: '/models/llama.gguf',
            contextSize: 8192,
            gpuLayers: 32,
            threads: 8,
            port: 11470,
          },
        },
        undefined
      )
    );
  });

  it('preserves existing sidecar binary path when editing provider', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    const provider: ProviderConfig = {
      id: 'sidecar-1',
      displayName: 'Existing Sidecar',
      type: 'sidecar',
      sidecarConfig: {
        modelPath: '/models/original.gguf',
        binaryPath: '/Applications/MDXPad/Contents/Resources/sidecar',
        port: 11470,
      },
      isActive: false,
      status: 'disconnected',
      createdAt: '2024-01-01T00:00:00Z',
      updatedAt: '2024-01-01T00:00:00Z',
    };

    render(<ProviderForm provider={provider} onSubmit={onSubmit} onCancel={vi.fn()} />);

    expect(screen.queryByLabelText('Provider Type')).toBeNull();
    expect(screen.getByLabelText<HTMLInputElement>('Model Path').value).toBe('/models/original.gguf');

    fireEvent.change(screen.getByLabelText('Display Name'), { target: { value: 'Updated Sidecar' } });
    fireEvent.change(screen.getByLabelText('Model Path'), {
      target: { value: '/models/updated.gguf' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Update Provider' }));

    await waitFor(() =>
      expect(onSubmit).toHaveBeenCalledWith(
        {
          displayName: 'Updated Sidecar',
          type: 'sidecar',
          sidecarConfig: {
            modelPath: '/models/updated.gguf',
            binaryPath: '/Applications/MDXPad/Contents/Resources/sidecar',
            port: 11470,
          },
        },
        undefined
      )
    );
  });
});
