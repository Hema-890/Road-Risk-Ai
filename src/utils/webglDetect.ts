import * as maplibregl from 'maplibre-gl';

export interface WebGLDiagnostic {
  supported: boolean;
  version: 'webgl2' | 'webgl' | null;
  vendor: string;
  renderer: string;
  error?: string;
}

/**
 * Safely inspects whether the browser/GPU environment allows WebGL context creation.
 * Uses low-overhead, conservative context attributes so it will not fail due to
 * demanding MSAA / antialias / depth requests.
 */
export function checkWebGLSupport(): WebGLDiagnostic {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return {
      supported: false,
      version: null,
      vendor: 'Unknown',
      renderer: 'Server-side Environment',
      error: 'Window or Document is undefined',
    };
  }

  // 1. Check MapLibre built-in support predicate if available
  try {
    const ml = maplibregl as any;
    if (typeof ml !== 'undefined' && typeof ml.supported === 'function') {
      const isMapLibreSupported = ml.supported({ failIfMajorPerformanceCaveat: false });
      if (!isMapLibreSupported) {
        return {
          supported: false,
          version: null,
          vendor: 'Disabled',
          renderer: 'Hardware Acceleration Disabled',
          error: 'MapLibre GL reported WebGL unsupported in this environment.',
        };
      }
    }
  } catch (err: any) {
    return {
      supported: false,
      version: null,
      vendor: 'Disabled',
      renderer: 'Exception during MapLibre support check',
      error: err?.message || String(err),
    };
  }

  // 2. Safe Canvas Context Probe
  try {
    const canvas = document.createElement('canvas');
    canvas.width = 1;
    canvas.height = 1;

    let gl: WebGLRenderingContext | WebGL2RenderingContext | null = null;
    let version: 'webgl2' | 'webgl' | null = null;

    // Try WebGL2 first with minimal attributes
    try {
      gl = canvas.getContext('webgl2', {
        failIfMajorPerformanceCaveat: false,
        antialias: false,
        depth: true,
        stencil: false,
        alpha: false,
        preserveDrawingBuffer: false,
      }) as WebGL2RenderingContext | null;
      if (gl) version = 'webgl2';
    } catch {
      // Fall through to WebGL 1
    }

    // Try WebGL 1
    if (!gl) {
      try {
        gl = (canvas.getContext('webgl', {
          failIfMajorPerformanceCaveat: false,
          antialias: false,
          depth: true,
          stencil: false,
          alpha: false,
          preserveDrawingBuffer: false,
        }) ||
          canvas.getContext('experimental-webgl', {
            failIfMajorPerformanceCaveat: false,
            antialias: false,
            depth: true,
            stencil: false,
            alpha: false,
            preserveDrawingBuffer: false,
          })) as WebGLRenderingContext | null;
        if (gl) version = 'webgl';
      } catch {
        // Context creation threw
      }
    }

    if (!gl) {
      return {
        supported: false,
        version: null,
        vendor: 'Disabled',
        renderer: 'GPU Context Creation Rejected',
        error: 'Unable to initialize WebGL context (GL_VENDOR = Disabled / Sandboxed).',
      };
    }

    // Query GPU Vendor and Renderer strings
    let vendor = 'Standard WebGL';
    let renderer = 'Standard WebGL Renderer';
    try {
      const ext = gl.getExtension('WEBGL_debug_renderer_info');
      if (ext) {
        vendor = gl.getParameter(ext.UNMASKED_VENDOR_WEBGL) || vendor;
        renderer = gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) || renderer;
      }
    } catch {
      // Extension may be blocked in strict security modes
    }

    // Clean up test context
    try {
      const loseContext = gl.getExtension('WEBGL_lose_context');
      if (loseContext) loseContext.loseContext();
    } catch {
      // ignore cleanup issue
    }

    return {
      supported: true,
      version,
      vendor,
      renderer,
    };
  } catch (err: any) {
    return {
      supported: false,
      version: null,
      vendor: 'Disabled',
      renderer: 'Exception caught',
      error: err?.message || 'Failed to initialize WebGL',
    };
  }
}
