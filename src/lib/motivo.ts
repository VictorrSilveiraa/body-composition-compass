// Explica em português o motivo real de uma recusa, em vez de esconder atrás de um aviso genérico.
type HasFields = { message?: unknown; code?: unknown; error_code?: unknown };

function textOf(e: unknown): string {
  if (e instanceof Error) return e.message;
  if (typeof e === 'string') return e;
  if (!e || typeof e !== 'object') return '';
  const o = e as HasFields;
  return [o.message, o.code, o.error_code].filter(v => typeof v === 'string').join(' ');
}

export function motivo(e: unknown, fallback: string): string {
  const m = textOf(e);
  if (/auth session missing|session_not_found|refresh_token_not_found|refresh_token_already_used|otp_expired|token.*expired|invalid.*token/i.test(m)) return 'Esse link expirou ou já foi usado. Peça um novo em "Esqueci minha senha".';
  if (/same_password|different from.*old password/i.test(m)) return 'Essa já é sua senha atual. Escolha outra senha ou volte para entrar.';
  if (/weak_password|password.*at least|password.*should contain/i.test(m)) return 'A senha não atende aos requisitos. Use pelo menos 8 caracteres, com letras, números e símbolos.';
  if (/known to be weak|weak and easy/i.test(m)) return 'Essa senha é fácil de adivinhar. Escolha uma mais forte, com letras e números.';
  if (/already registered/i.test(m)) return 'Este e-mail já tem conta. Entre com a senha ou use "Esqueci minha senha".';
  if (/invalid login credentials/i.test(m)) return 'E-mail ou senha não conferem. Confira ou use "Esqueci minha senha".';
  if (/email not confirmed/i.test(m)) return 'Confirme o e-mail primeiro: abra o link que enviamos para você.';
  if (/not allowed|placeholder, reserved/i.test(m)) return 'Esse e-mail não pode receber mensagens. Use um e-mail de verdade, como gmail ou hotmail.';
  if (/for security purposes, you can only request this after/i.test(m)) return 'Espere alguns segundos e peça o link de novo.';
  if (/rate.?limit|too many/i.test(m)) return 'Muitas tentativas seguidas. Aguarde alguns minutos e tente de novo.';
  if (/row-level security|not authorized|permission denied/i.test(m)) return 'Você não tem permissão para guardar isso aqui.';
  if (/failed to fetch|networkerror|load failed|offline/i.test(m)) return 'Sem conexão. Tente de novo quando estiver online.';
  if (/duplicate key/i.test(m)) return 'Isso já foi guardado antes.';
  if (/data futura/i.test(m)) return 'A avaliação não pode ter data futura.';
  if (/^Backup inválido$/i.test(m)) return 'Esse arquivo não é um backup do app.';
  if (/^Pessoa inválida$/i.test(m)) return 'O backup tem uma pessoa sem nome, sem sexo ou sem data de nascimento.';
  if (/^Avaliação inválida$/i.test(m)) return 'O backup tem uma avaliação sem pessoa, sem data ou com peso inválido.';
  if (/^Pessoa ausente$/i.test(m)) return 'O backup tem avaliações sem a pessoa correspondente.';
  if (/Unexpected end of JSON input|Unexpected token|is not valid JSON/i.test(m)) return 'Esse arquivo não é um backup do app.';
  return fallback;
}
