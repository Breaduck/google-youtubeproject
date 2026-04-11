// API 키 암호화/복호화 유틸리티
// 완벽한 보안은 아니지만 평문 저장보다 안전

const ENCRYPTION_KEY = 'v1d30-s44s-3ncrypt10n-k3y-2024';

// 간단한 XOR 기반 암호화 (base64 인코딩)
export function encryptApiKey(plainText: string): string {
  if (!plainText) return '';

  let encrypted = '';
  for (let i = 0; i < plainText.length; i++) {
    const charCode = plainText.charCodeAt(i) ^ ENCRYPTION_KEY.charCodeAt(i % ENCRYPTION_KEY.length);
    encrypted += String.fromCharCode(charCode);
  }

  return btoa(encrypted); // base64 인코딩
}

export function decryptApiKey(encryptedText: string): string {
  if (!encryptedText) return '';

  try {
    const decoded = atob(encryptedText); // base64 디코딩
    let decrypted = '';
    for (let i = 0; i < decoded.length; i++) {
      const charCode = decoded.charCodeAt(i) ^ ENCRYPTION_KEY.charCodeAt(i % ENCRYPTION_KEY.length);
      decrypted += String.fromCharCode(charCode);
    }
    return decrypted;
  } catch {
    // 복호화 실패 시 원본 반환 (마이그레이션 호환)
    return encryptedText;
  }
}

// 비밀번호 해싱 (SHA-256)
export async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(password + 'video-saas-salt-2024');
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

// 비밀번호 검증
export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  const passwordHash = await hashPassword(password);
  return passwordHash === hash;
}

// 마이그레이션: 기존 평문 키를 암호화된 키로 변환
export function migrateApiKeys(): void {
  const keysToMigrate = [
    'gemini_api_key',
    'byteplus_api_key',
    'evolink_api_key',
    'runware_api_key',
    'elevenlabs_api_key',
    'chirp_api_key'
  ];

  keysToMigrate.forEach(key => {
    const value = localStorage.getItem(key);
    if (value && !value.startsWith('ENC:')) {
      // 아직 암호화되지 않은 키
      const encrypted = 'ENC:' + encryptApiKey(value);
      localStorage.setItem(key, encrypted);
    }
  });
}

// 안전하게 API 키 저장
export function saveApiKey(key: string, value: string): void {
  if (!value) {
    localStorage.removeItem(key);
    return;
  }
  const encrypted = 'ENC:' + encryptApiKey(value);
  localStorage.setItem(key, encrypted);
}

// 안전하게 API 키 불러오기
export function loadApiKey(key: string): string {
  const value = localStorage.getItem(key);
  if (!value) return '';

  if (value.startsWith('ENC:')) {
    return decryptApiKey(value.slice(4));
  }

  // 마이그레이션: 평문이면 암호화해서 다시 저장
  const encrypted = 'ENC:' + encryptApiKey(value);
  localStorage.setItem(key, encrypted);
  return value;
}
