import { describe, it, expect } from 'vitest';
import { motivo } from '@/lib/motivo';

describe('motivo', () => {
  it.each(['Auth session missing!', 'otp_expired', 'refresh_token_not_found'])('identifica recuperação inválida: %s', code => {
    expect(motivo({code}, 'genérico')).not.toBe('genérico');
  });
  it('identifica senha igual à atual', () => {
    expect(motivo({code:'same_password'}, 'genérico')).not.toBe('genérico');
  });
  it('explica senha fraca', () => {
    expect(motivo(new Error('Password is known to be weak and easy to guess, please choose a different one.'), 'genérico'))
      .toBe('Essa senha é fácil de adivinhar. Escolha uma mais forte, com letras e números.');
  });
  it('explica e-mail que já tem conta', () => {
    expect(motivo(new Error('User already registered'), 'genérico'))
      .toBe('Este e-mail já tem conta. Entre com a senha ou use "Esqueci minha senha".');
  });
  it('explica login errado', () => {
    expect(motivo(new Error('Invalid login credentials'), 'genérico'))
      .toBe('E-mail ou senha não conferem. Confira ou use "Esqueci minha senha".');
  });
  it('explica e-mail não confirmado', () => {
    expect(motivo(new Error('Email not confirmed'), 'genérico'))
      .toBe('Confirme o e-mail primeiro: abra o link que enviamos para você.');
  });
  it('explica limite de envios', () => {
    expect(motivo(new Error('over_email_send_rate_limit'), 'genérico'))
      .toBe('Muitas tentativas seguidas. Aguarde alguns minutos e tente de novo.');
  });
  it('explica espera curta entre pedidos de link', () => {
    expect(motivo({ message: 'For security purposes, you can only request this after 3 seconds.', code: 'over_email_send_rate_limit' }, 'genérico'))
      .toBe('Espere alguns segundos e peça o link de novo.');
  });
  it('explica limite quando só o código informa', () => {
    expect(motivo({ message: 'alguma coisa estranha', code: 'over_email_send_rate_limit' }, 'genérico'))
      .toBe('Muitas tentativas seguidas. Aguarde alguns minutos e tente de novo.');
  });
  it('explica e-mail que não recebe mensagens', () => {
    expect(motivo({ message: 'This email address is not allowed. Placeholder, reserved, or mistyped domains such as example.com or gmai.com cannot receive email.' }, 'genérico'))
      .toBe('Esse e-mail não pode receber mensagens. Use um e-mail de verdade, como gmail ou hotmail.');
  });
  it('explica falta de permissão', () => {
    expect(motivo({ message: 'new row violates row-level security policy for table "pacientes"' }, 'genérico'))
      .toBe('Você não tem permissão para guardar isso aqui.');
  });
  it('explica aparelho sem internet', () => {
    expect(motivo(new TypeError('Failed to fetch'), 'genérico'))
      .toBe('Sem conexão. Tente de novo quando estiver online.');
  });
  it('explica data futura vinda do banco', () => {
    expect(motivo({ message: 'A avaliação não pode ter data futura' }, 'genérico'))
      .toBe('A avaliação não pode ter data futura.');
  });
  it('explica backup que não é do app', () => {
    expect(motivo(new Error('Backup inválido'), 'genérico'))
      .toBe('Esse arquivo não é um backup do app.');
    expect(motivo(new SyntaxError('Unexpected token } in JSON at position 5'), 'genérico'))
      .toBe('Esse arquivo não é um backup do app.');
  });
  it('explica pessoa inválida no backup', () => {
    expect(motivo(new Error('Pessoa inválida'), 'genérico'))
      .toBe('O backup tem uma pessoa sem nome, sem sexo ou sem data de nascimento.');
  });
  it('explica avaliação inválida no backup', () => {
    expect(motivo(new Error('Avaliação inválida'), 'genérico'))
      .toBe('O backup tem uma avaliação sem pessoa, sem data ou com peso inválido.');
  });
  it('mantém o aviso geral quando nada se aplica', () => {
    expect(motivo(new Error('alguma coisa estranha'), 'Não foi possível salvar. Tente novamente.'))
      .toBe('Não foi possível salvar. Tente novamente.');
    expect(motivo(undefined, 'Não foi possível salvar. Tente novamente.'))
      .toBe('Não foi possível salvar. Tente novamente.');
  });
});
