import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { Activity, AlertTriangle, ArrowRight, Check, ChevronLeft, Eye, EyeOff, KeyRound, LockKeyhole, Mail, ShieldCheck } from 'lucide-react';
import { Button } from './ui/button';
import { supabase } from '@/integrations/supabase/client';
import { motivo } from '@/lib/motivo';
import { ripple, scan } from '@/lib/motion';

/*
 * Tela de acesso: cartão destacado do fundo (computador) com a ilustração à esquerda e o formulário à direita;
 * no celular, a ilustração vira um banner no topo. A mesma moldura (AuthShell) é usada no portal do paciente.
 */
export function AuthShell({ kicker, title, text, children }: { kicker: string; title: string; text: string; children: ReactNode }) {
  const root = useRef<HTMLElement>(null);
  useLayoutEffect(() => { scan(root.current); });
  useEffect(() => { document.addEventListener('pointerdown', ripple, { passive: true }); return () => document.removeEventListener('pointerdown', ripple); }, []);
  return (
    <main className="lg" ref={root}>
      <div className="lg-card">
        <aside className="lg-art">
          <img src="/login-ilustracao.webp" alt="" aria-hidden="true" width={1086} height={1448} decoding="async" fetchPriority="high" />
          <div className="lg-brand lg-brand-m" aria-hidden="true"><span className="lg-mark"><Activity size={17} /></span><span>Avaliação Física</span></div>
          <div className="lg-art-copy"><span className="tag">{kicker}</span><h2>{title}</h2><p>{text}</p></div>
        </aside>
        <section className="lg-main">
          <div className="lg-brand"><span className="lg-mark"><Activity size={20} /></span><span>Avaliação Física</span></div>
          <div className="lg-body">{children}</div>
          <p className="lg-safe"><ShieldCheck size={15} /> Conexão segura · seus dados ficam protegidos na sua conta</p>
        </section>
      </div>
    </main>
  );
}

type Mode = 'login' | 'signup' | 'forgot';
const MAX_TRIES = 5, LOCK_SECONDS = 30, RESEND_SECONDS = 60;
// foco automático só com mouse: no celular abriria o teclado por cima da ilustração
const finePointer = typeof window !== 'undefined' && window.matchMedia('(pointer: fine)').matches;

/** força da senha: 0 a 4 (comprimento, letras, números/símbolos, maiúsculas+minúsculas) */
export function passwordScore(p: string) {
  if (!p) return 0;
  let s = 0;
  if (p.length >= 8) s++;
  if (p.length >= 12) s++;
  if (/[a-z]/.test(p) && /[A-Z]/.test(p)) s++;
  if (/\d/.test(p) && /[^A-Za-z0-9]/.test(p)) s++;
  else if (/\d/.test(p) || /[^A-Za-z0-9]/.test(p)) s += 0.5;
  return Math.min(4, Math.floor(s));
}
const SCORE_LABEL = ['Muito fraca', 'Fraca', 'Razoável', 'Boa', 'Forte'];

function useCountdown() {
  const [left, setLeft] = useState(0);
  useEffect(() => { if (left <= 0) return; const t = setTimeout(() => setLeft((s) => s - 1), 1000); return () => clearTimeout(t); }, [left]);
  return [left, setLeft] as const;
}

function PasswordField({ id, label, value, onChange, autoComplete, placeholder, extra, invalid, describedBy }: {
  id: string; label: string; value: string; onChange: (v: string) => void; autoComplete: string; placeholder: string; extra?: ReactNode; invalid?: boolean | undefined; describedBy?: string | undefined;
}) {
  const [show, setShow] = useState(false), [caps, setCaps] = useState(false);
  const capsCheck = (e: React.KeyboardEvent<HTMLInputElement>) => setCaps(e.getModifierState?.('CapsLock') ?? false);
  return (
    <div className="field lg-field">
      <div className="lg-label"><label className="f-label" htmlFor={id}>{label}</label>{extra}</div>
      <div className={'f-input text lg-input' + (invalid ? ' bad' : '')}>
        <LockKeyhole size={18} />
        <input id={id} name={id} type={show ? 'text' : 'password'} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} minLength={8} maxLength={72}
          autoComplete={autoComplete} required onKeyUp={capsCheck} onKeyDown={capsCheck} onBlur={() => setCaps(false)} aria-invalid={invalid || undefined} aria-describedby={describedBy} />
        <button type="button" className="lg-eye" onClick={() => setShow(!show)} aria-label={show ? 'Ocultar senha' : 'Mostrar senha'} aria-pressed={show}>{show ? <EyeOff size={18} /> : <Eye size={18} />}</button>
      </div>
      {caps && <p className="lg-caps" role="status"><AlertTriangle size={14} /> Caps Lock está ligado</p>}
    </div>
  );
}

export function AuthScreen({ recovery = false }: { recovery?: boolean }) {
  const [mode, setMode] = useState<Mode>('login');
  const [email, setEmail] = useState(''), [password, setPassword] = useState(''), [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false), [message, setMessage] = useState(''), [error, setError] = useState('');
  const [fails, setFails] = useState(0);
  const [lock, setLock] = useCountdown(), [resend, setResend] = useCountdown();
  const [sentTo, setSentTo] = useState<{ kind: 'signup' | 'forgot'; email: string } | null>(null);
  const navigate = useNavigate();
  const emailRef = useRef<HTMLInputElement>(null);
  const cleanEmail = email.trim().toLowerCase();
  const isNew = recovery || mode === 'signup';
  const score = passwordScore(password);
  const mismatch = recovery && confirm.length > 0 && confirm !== password;

  // trocar de modo limpa mensagens e devolve o foco ao primeiro campo
  const switchMode = (m: Mode) => { setMode(m); setError(''); setMessage(''); setSentTo(null); setPassword(''); setConfirm(''); setTimeout(() => emailRef.current?.focus(), 30); };

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy || lock > 0) return;
    setError(''); setMessage('');
    if (isNew && password.length < 8) { setError('Use uma senha com pelo menos 8 caracteres.'); return; }
    if (isNew && score < 2) { setError('Senha fraca: misture letras maiúsculas e minúsculas, números ou símbolos.'); return; }
    if (recovery && confirm !== password) { setError('As duas senhas não são iguais.'); return; }
    setBusy(true);
    try {
      if (recovery) {
        const params = new URLSearchParams(window.location.hash.slice(1));
        if (params.has('error') || params.has('error_code')) { setError('Esse link expirou ou já foi usado. Volte para entrar e peça outro em "Esqueci minha senha".'); return; }
        const { data, error: sessionError } = await supabase.auth.getUser();
        if (sessionError || !data.user) { setError('Abra o link mais recente enviado ao seu e-mail. Se ele expirou, peça outro em "Esqueci minha senha".'); return; }
        const { error } = await supabase.auth.updateUser({ password });
        if (error) throw error;
        setMessage('Senha atualizada. Você já pode entrar.');
        return;
      }
      if (mode === 'forgot') {
        const { error } = await supabase.auth.resetPasswordForEmail(cleanEmail, { redirectTo: window.location.origin + '/reset-password' });
        if (error) throw error;
        // mesma resposta exista ou não a conta (não revela quais e-mails estão cadastrados)
        setSentTo({ kind: 'forgot', email: cleanEmail }); setResend(RESEND_SECONDS);
        setMessage('Se este e-mail tiver conta, chega um link para criar uma nova senha. Confira também o spam.');
      } else if (mode === 'signup') {
        const { data, error } = await supabase.auth.signUp({ email: cleanEmail, password, options: { emailRedirectTo: window.location.origin } });
        if (error) throw error;
        if (data.session) await navigate({ to: '/' });
        else if (data.user?.created_at && Date.now() - new Date(data.user.created_at).getTime() > 60000) setError('Este e-mail já tem conta. Entre com a senha ou use "Esqueci minha senha".');
        else { setSentTo({ kind: 'signup', email: cleanEmail }); setResend(RESEND_SECONDS); setMessage('Enviamos um link de confirmação. Abra seu e-mail e confirme o cadastro para entrar.'); }
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email: cleanEmail, password });
        if (error) throw error;
        setFails(0);
        await navigate({ to: '/' });
      }
    } catch (err) {
      if (mode === 'login' && !recovery) {
        // muitas tentativas seguidas: pausa curta antes de tentar de novo
        const n = fails + 1; setFails(n);
        if (n >= MAX_TRIES) { setLock(LOCK_SECONDS); setFails(0); setError(`Muitas tentativas. Aguarde ${LOCK_SECONDS} segundos ou use "Esqueci minha senha".`); setPassword(''); return; }
      }
      setError(motivo(err, recovery ? 'Não foi possível salvar a senha. Peça um novo link em "Esqueci minha senha" e tente novamente.' : 'Não foi possível continuar. Confira os dados e tente novamente.'));
    } finally { setBusy(false); }
  }

  async function resendEmail() {
    if (!sentTo || resend > 0) return;
    setError('');
    try {
      const r = sentTo.kind === 'signup'
        ? await supabase.auth.resend({ type: 'signup', email: sentTo.email, options: { emailRedirectTo: window.location.origin } })
        : await supabase.auth.resetPasswordForEmail(sentTo.email, { redirectTo: window.location.origin + '/reset-password' });
      if (r.error) throw r.error;
      setResend(RESEND_SECONDS);
    } catch (err) { setError(motivo(err, 'Não foi possível reenviar agora. Tente de novo em instantes.')); }
  }

  const heading = recovery ? 'Crie uma nova senha' : mode === 'signup' ? 'Crie sua conta' : mode === 'forgot' ? 'Recuperar senha' : 'Bem-vindo(a) de volta';
  const sub = recovery ? 'Escolha uma senha forte que você não use em outros sites.' : mode === 'signup' ? 'Leva menos de um minuto. Depois você monta seu perfil profissional.' : mode === 'forgot' ? 'Informe o e-mail da conta e enviamos um link para criar uma nova senha.' : 'Entre para acompanhar seus pacientes e avaliações.';
  const cta = busy ? 'Aguarde…' : lock > 0 ? `Aguarde ${lock}s` : recovery ? 'Salvar nova senha' : mode === 'signup' ? 'Criar conta' : mode === 'forgot' ? 'Enviar link' : 'Entrar';

  return (
    <AuthShell kicker="Para nutricionistas" title={recovery ? 'Uma nova senha, e pronto.' : mode === 'signup' ? 'Monte seu espaço de atendimento.' : 'Que bom ter você aqui.'} text="Seus pacientes, as avaliações e a evolução de cada um, num só lugar.">
      {!recovery && mode !== 'forgot' && !message && (
        <div className="seg full lg-tabs" role="tablist" aria-label="Acesso">
          <button type="button" role="tab" aria-selected={mode === 'login'} className={mode === 'login' ? 'on' : ''} onClick={() => switchMode('login')}>Entrar</button>
          <button type="button" role="tab" aria-selected={mode === 'signup'} className={mode === 'signup' ? 'on' : ''} onClick={() => switchMode('signup')}>Criar conta</button>
        </div>
      )}
      {mode === 'forgot' && !message && <button type="button" className="lg-back" onClick={() => switchMode('login')}><ChevronLeft size={18} /> Voltar para entrar</button>}
      <h1 className="lg-title">{heading}</h1>
      <p className="lg-sub">{sub}</p>

      {message ? (
        <div className="lg-done" role="status">
          <span className="lg-done-ico"><Check size={26} strokeWidth={2.6} /></span>
          <p>{message}</p>
          {sentTo && <p className="small muted">Enviado para <b>{sentTo.email}</b></p>}
          {error && <p className="auth-error" role="alert">{error}</p>}
          <div className="lg-done-btns">
            {sentTo && <Button variant="original" type="button" className="btn ghost" onClick={() => void resendEmail()} disabled={resend > 0}>{resend > 0 ? `Reenviar em ${resend}s` : 'Reenviar e-mail'}</Button>}
            <Button variant="original" type="button" className="btn dark" onClick={() => { setMessage(''); setSentTo(null); setMode('login'); if (recovery) void navigate({ to: '/login' }); }}>Voltar para entrar</Button>
          </div>
        </div>
      ) : (
        <form className="lg-form" onSubmit={submit} noValidate={false}>
          {!recovery && (
            <div className="field lg-field">
              <div className="lg-label"><label className="f-label" htmlFor="email">E-mail</label></div>
              <div className="f-input text lg-input"><Mail size={18} />
                <input ref={emailRef} id="email" name="email" type="email" inputMode="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="voce@exemplo.com"
                  autoComplete={mode === 'signup' ? 'email' : 'username'} autoCapitalize="none" spellCheck={false} maxLength={254} required autoFocus={finePointer} disabled={busy} />
              </div>
            </div>
          )}
          {(recovery || mode !== 'forgot') && (
            <PasswordField id="password" label={recovery ? 'Nova senha' : 'Senha'} value={password} onChange={setPassword}
              autoComplete={isNew ? 'new-password' : 'current-password'} placeholder={isNew ? 'Mínimo de 8 caracteres' : 'Sua senha'} describedBy={isNew ? 'pw-meter' : undefined}
              extra={mode === 'login' && !recovery ? <button type="button" className="lg-link" onClick={() => switchMode('forgot')}>Esqueci minha senha</button> : undefined} />
          )}
          {isNew && password.length > 0 && (
            <div className="lg-meter" id="pw-meter" aria-live="polite">
              <div className="lg-bars">{[0, 1, 2, 3].map((i) => <i key={i} className={i < score ? 'on s' + score : ''} />)}</div>
              <span>{SCORE_LABEL[score]}{score < 2 ? ' · use letras, números e símbolos' : ''}</span>
            </div>
          )}
          {recovery && <PasswordField id="confirm" label="Confirmar nova senha" value={confirm} onChange={setConfirm} autoComplete="new-password" placeholder="Repita a senha" invalid={mismatch} />}
          {mismatch && <p className="lg-caps bad">As senhas não são iguais</p>}
          {error && <p className="auth-error lg-error" role="alert"><AlertTriangle size={16} /> {error}</p>}
          <Button variant="original" type="submit" className="btn dark lg-submit" disabled={busy || lock > 0}>{busy && <span className="lg-spin" aria-hidden="true" />}{cta}{!busy && lock === 0 && <ArrowRight size={18} />}</Button>
          {mode === 'signup' && <p className="lg-fine">Ao criar a conta, você confirma o e-mail antes do primeiro acesso.</p>}
        </form>
      )}

      {!recovery && mode === 'login' && !message && (
        <>
          <div className="lg-or"><span>ou</span></div>
          <a className="auth-patient lg-patient" href="/paciente"><span className="chip-ico"><KeyRound size={18} /></span><span className="grow"><b>Sou paciente</b><span>Entrar com o código do meu nutricionista</span></span><ArrowRight size={18} /></a>
        </>
      )}
    </AuthShell>
  );
}
