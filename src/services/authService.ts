/**
 * RoadRisk AI - Enterprise Authentication Service
 * Dual-mode: Supabase Auth (primary) with local Operator Session fallback
 */

import { supabase, isSupabaseConfigured } from '../lib/supabaseClient';
import type { User, Session } from '@supabase/supabase-js';

export type UserRole = 'dispatcher' | 'paramedic' | 'traffic_admin' | 'viewer';

export interface AuthProfile {
  id: string;
  email: string;
  fullName: string;
  role: UserRole;
  badgeNumber?: string;
  organization?: string;
  phone?: string;
}

export interface AuthState {
  isAuthenticated: boolean;
  user: AuthProfile | null;
  session: Session | null;
  mode: 'cloud' | 'local';
  loading: boolean;
  error: string | null;
}

const LOCAL_STORAGE_KEY = 'roadrisk_auth_session';

class AuthService {
  private currentProfile: AuthProfile | null = null;
  private currentSession: Session | null = null;
  private listeners: Set<(state: AuthState) => void> = new Set();
  private authSubscription: { unsubscribe: () => void } | null = null;

  constructor() {
    this.initialize();
  }

  private initialize(): void {
    if (isSupabaseConfigured() && supabase) {
      // 1. Check active Supabase session
      supabase.auth.getSession().then(({ data: { session } }) => {
        if (session?.user) {
          this.currentSession = session;
          this.fetchUserProfile(session.user);
        } else {
          this.loadLocalSessionFallback();
        }
      }).catch(() => {
        this.loadLocalSessionFallback();
      });

      // 2. Listen to Supabase auth state changes
      const { data: { subscription } } = supabase.auth.onAuthStateChange(
        async (_event, session) => {
          this.currentSession = session;
          if (session?.user) {
            await this.fetchUserProfile(session.user);
          } else {
            this.currentProfile = null;
            this.notifyListeners();
          }
        }
      );
      this.authSubscription = subscription;
    } else {
      // Local fallback mode
      this.loadLocalSessionFallback();
    }
  }

  private loadLocalSessionFallback(): void {
    try {
      const stored = localStorage.getItem(LOCAL_STORAGE_KEY);
      if (stored) {
        this.currentProfile = JSON.parse(stored);
      } else {
        // Default local operator session
        this.currentProfile = {
          id: 'local-operator-01',
          email: 'dispatcher@roadrisk.ai',
          fullName: 'Primary Dispatch Operator',
          role: 'dispatcher',
          badgeNumber: 'EMS-DISP-101',
          organization: 'AP Emergency Medical Response',
        };
        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(this.currentProfile));
      }
    } catch {
      this.currentProfile = null;
    }
    this.notifyListeners();
  }

  private async fetchUserProfile(user: User): Promise<void> {
    if (!supabase) return;
    try {
      const { data, error } = await (supabase.from('profiles') as any)
        .select('*')
        .eq('id', user.id)
        .single();

      if (error || !data) {
        // Build fallback profile from user metadata
        this.currentProfile = {
          id: user.id,
          email: user.email || 'operator@roadrisk.ai',
          fullName: (user.user_metadata?.full_name as string) || user.email?.split('@')[0] || 'Cloud Operator',
          role: (user.user_metadata?.role as UserRole) || 'dispatcher',
          badgeNumber: user.user_metadata?.badge_number as string,
          organization: user.user_metadata?.organization as string,
        };
      } else {
        this.currentProfile = {
          id: data.id,
          email: data.email,
          fullName: data.full_name,
          role: (data.role as UserRole) || 'dispatcher',
          badgeNumber: data.badge_number || undefined,
          organization: data.organization || undefined,
          phone: data.phone || undefined,
        };
      }
    } catch {
      this.currentProfile = {
        id: user.id,
        email: user.email || 'operator@roadrisk.ai',
        fullName: 'Cloud Operator',
        role: 'dispatcher',
      };
    }
    this.notifyListeners();
  }

  public subscribe(listener: (state: AuthState) => void): () => void {
    this.listeners.add(listener);
    // Emit immediate current state
    listener(this.getState());
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notifyListeners(): void {
    const state = this.getState();
    this.listeners.forEach((listener) => {
      try {
        listener(state);
      } catch (err) {
        console.error('[AuthService] Error in listener:', err);
      }
    });
  }

  public getState(): AuthState {
    return {
      isAuthenticated: Boolean(this.currentProfile),
      user: this.currentProfile,
      session: this.currentSession,
      mode: isSupabaseConfigured() ? 'cloud' : 'local',
      loading: false,
      error: null,
    };
  }

  public async signIn(email: string, password?: string): Promise<{ success: boolean; error?: string }> {
    if (isSupabaseConfigured() && supabase && password) {
      try {
        const { data, error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) {
          return { success: false, error: error.message };
        }
        if (data.session) {
          this.currentSession = data.session;
          if (data.user) {
            await this.fetchUserProfile(data.user);
          }
          return { success: true };
        }
      } catch (err: any) {
        return { success: false, error: err?.message || 'Authentication failed' };
      }
    }

    // Local authentication fallback
    this.currentProfile = {
      id: `local-operator-${Date.now().toString().slice(-4)}`,
      email,
      fullName: email.split('@')[0] || 'Operator',
      role: 'dispatcher',
      badgeNumber: 'EMS-LOCAL-01',
      organization: 'Emergency Operations',
    };
    try {
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(this.currentProfile));
    } catch {
      // Ignore storage error
    }
    this.notifyListeners();
    return { success: true };
  }

  public async signUp(email: string, password: string, fullName: string, role: UserRole = 'dispatcher'): Promise<{ success: boolean; error?: string }> {
    if (isSupabaseConfigured() && supabase) {
      try {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              full_name: fullName,
              role,
            },
          },
        });
        if (error) return { success: false, error: error.message };
        if (data.user) {
          await this.fetchUserProfile(data.user);
          return { success: true };
        }
      } catch (err: any) {
        return { success: false, error: err?.message || 'Sign up failed' };
      }
    }

    // Local fallback
    this.currentProfile = {
      id: `local-${Date.now()}`,
      email,
      fullName,
      role,
    };
    try {
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(this.currentProfile));
    } catch {}
    this.notifyListeners();
    return { success: true };
  }

  public async signOut(): Promise<void> {
    if (isSupabaseConfigured() && supabase) {
      try {
        await supabase.auth.signOut();
      } catch (err) {
        console.warn('[AuthService] Supabase signOut warning:', err);
      }
    }
    this.currentProfile = null;
    this.currentSession = null;
    try {
      localStorage.removeItem(LOCAL_STORAGE_KEY);
    } catch {}
    this.notifyListeners();
  }

  public getCurrentUser(): AuthProfile | null {
    return this.currentProfile;
  }

  public destroy(): void {
    if (this.authSubscription) {
      this.authSubscription.unsubscribe();
      this.authSubscription = null;
    }
    this.listeners.clear();
  }
}

export const authService = new AuthService();
export default authService;
