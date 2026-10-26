'use client';

import { createContext, useContext, useEffect, useRef, useState } from 'react';
import { supabase } from './supabase';
import type { User, Session } from '@supabase/supabase-js';

interface UserProfile {
  id: number;
  name: string;
  phone: string;
  apartment: string;
  sokh_id: number;
  debt: number;
  resident_type: string | null;
  household_size: number | null;
  move_in_date: string | null;
  profile_completed_at: string | null;
  monthly_fee: number | null; // тухайн айлын тусгай тариф; null бол СӨХ-ийн ерөнхий дүн
}

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: UserProfile | null;
  loading: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  session: null,
  profile: null,
  loading: true,
  signOut: async () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  // getSession + INITIAL_SESSION/SIGNED_IN нь нэг хэрэглэгчийг давхар татуулдаг
  const profileUserIdRef = useRef<string | null>(null);

  useEffect(() => {
    // Одоогийн session авах
    supabase.auth.getSession().then(({ data: { session: s } }) => {
      setSession(s);
      setUser(s?.user ?? null);
      if (s?.user) {
        fetchProfile(s.user);
      } else {
        setLoading(false);
      }
    });

    // Auth state өөрчлөлтийг сонсох
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, s) => {
      setSession(s);
      setUser(s?.user ?? null);
      if (s?.user) {
        // TOKEN_REFRESHED нь профайлыг өөрчлөхгүй — дахин татах шаардлагагүй
        if (event === 'USER_UPDATED') profileUserIdRef.current = null;
        if (event !== 'TOKEN_REFRESHED') fetchProfile(s.user);
      } else {
        profileUserIdRef.current = null;
        setProfile(null);
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const fetchProfile = async (u: User) => {
    if (profileUserIdRef.current === u.id) return;
    profileUserIdRef.current = u.id;

    // user metadata-н утсаар, утасгүй бол auth_user_id-аар resident хайх.
    // Шүүлтгүй query нь RLS-ийн хүрээнд ӨӨР оршин суугчийн мөрийг буцаадаг байсан.
    const phone = u.user_metadata?.phone;

    const query = phone
      ? supabase.from('residents').select('*').eq('phone', phone)
      : supabase.from('residents').select('*').eq('auth_user_id', u.id);

    const { data, error } = await query.limit(1).maybeSingle();
    if (error) profileUserIdRef.current = null; // дараагийн auth event дээр дахин оролдоно

    if (data) {
      setProfile({
        id: data.id,
        name: data.name,
        phone: data.phone,
        apartment: data.apartment,
        sokh_id: data.sokh_id,
        debt: data.debt,
        resident_type: data.resident_type ?? null,
        household_size: data.household_size ?? null,
        move_in_date: data.move_in_date ?? null,
        profile_completed_at: data.profile_completed_at ?? null,
        monthly_fee: data.monthly_fee ?? null,
      });
    }
    setLoading(false);
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    profileUserIdRef.current = null;
    setUser(null);
    setSession(null);
    setProfile(null);
  };

  return (
    <AuthContext.Provider value={{ user, session, profile, loading, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
