// 통합 에러 처리 유틸리티

export type ErrorType =
  | 'network'      // 네트워크 오류
  | 'api'          // API 응답 오류
  | 'validation'   // 입력값 검증 오류
  | 'auth'         // 인증/권한 오류
  | 'quota'        // 할당량 초과
  | 'unknown';     // 알 수 없는 오류

export interface AppError {
  type: ErrorType;
  message: string;
  details?: string;
  code?: string | number;
  retry?: boolean;
}

// 에러 타입 판별
export function classifyError(error: unknown): AppError {
  // 네트워크 오류
  if (error instanceof TypeError && error.message.includes('fetch')) {
    return {
      type: 'network',
      message: '인터넷 연결을 확인해주세요.',
      details: error.message,
      retry: true
    };
  }

  // API 응답 오류
  if (error && typeof error === 'object' && 'status' in error) {
    const status = (error as { status: number }).status;
    const message = (error as { message?: string }).message || '';

    if (status === 401 || status === 403) {
      return {
        type: 'auth',
        message: 'API 키가 유효하지 않습니다. 설정에서 확인해주세요.',
        code: status,
        retry: false
      };
    }

    if (status === 429) {
      return {
        type: 'quota',
        message: 'API 사용량을 초과했습니다. 잠시 후 다시 시도해주세요.',
        code: status,
        retry: true
      };
    }

    if (status >= 500) {
      return {
        type: 'api',
        message: '서버에 문제가 발생했습니다. 잠시 후 다시 시도해주세요.',
        code: status,
        retry: true
      };
    }

    return {
      type: 'api',
      message: message || '요청 처리 중 오류가 발생했습니다.',
      code: status,
      retry: true
    };
  }

  // 일반 Error 객체
  if (error instanceof Error) {
    // 특정 에러 메시지 패턴 감지
    const msg = error.message.toLowerCase();

    if (msg.includes('api key') || msg.includes('unauthorized') || msg.includes('invalid key')) {
      return {
        type: 'auth',
        message: 'API 키가 유효하지 않습니다.',
        details: error.message,
        retry: false
      };
    }

    if (msg.includes('quota') || msg.includes('rate limit') || msg.includes('too many')) {
      return {
        type: 'quota',
        message: 'API 사용량을 초과했습니다.',
        details: error.message,
        retry: true
      };
    }

    if (msg.includes('network') || msg.includes('failed to fetch') || msg.includes('timeout')) {
      return {
        type: 'network',
        message: '네트워크 연결에 문제가 있습니다.',
        details: error.message,
        retry: true
      };
    }

    return {
      type: 'unknown',
      message: error.message || '알 수 없는 오류가 발생했습니다.',
      details: error.stack,
      retry: true
    };
  }

  // 문자열 에러
  if (typeof error === 'string') {
    return {
      type: 'unknown',
      message: error,
      retry: true
    };
  }

  return {
    type: 'unknown',
    message: '알 수 없는 오류가 발생했습니다.',
    retry: true
  };
}

// 사용자 친화적 에러 메시지 생성
export function getUserFriendlyMessage(error: AppError): string {
  switch (error.type) {
    case 'network':
      return '인터넷 연결을 확인하고 다시 시도해주세요.';
    case 'auth':
      return '설정에서 API 키를 확인해주세요.';
    case 'quota':
      return '잠시 후 다시 시도하거나, API 사용량을 확인해주세요.';
    case 'api':
      return error.message;
    case 'validation':
      return error.message;
    default:
      return error.message || '문제가 발생했습니다. 다시 시도해주세요.';
  }
}

// 에러 로깅 (콘솔 + 선택적 외부 서비스)
export function logError(context: string, error: unknown): AppError {
  const appError = classifyError(error);

  // 개발 환경에서만 상세 로그
  if (import.meta.env.DEV) {
    console.group(`[Error] ${context}`);
    console.error('Type:', appError.type);
    console.error('Message:', appError.message);
    if (appError.details) console.error('Details:', appError.details);
    if (appError.code) console.error('Code:', appError.code);
    console.groupEnd();
  } else {
    // 프로덕션에서는 간단히
    console.error(`[${context}] ${appError.type}: ${appError.message}`);
  }

  return appError;
}

// try-catch 래퍼 함수
export async function safeExecute<T>(
  fn: () => Promise<T>,
  context: string,
  onError?: (error: AppError) => void
): Promise<T | null> {
  try {
    return await fn();
  } catch (error) {
    const appError = logError(context, error);
    if (onError) {
      onError(appError);
    }
    return null;
  }
}

// 재시도 로직이 포함된 실행
export async function executeWithRetry<T>(
  fn: () => Promise<T>,
  context: string,
  maxRetries: number = 2,
  delayMs: number = 1000
): Promise<T> {
  let lastError: unknown;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      const appError = classifyError(error);

      // 재시도 불가능한 에러면 바로 throw
      if (!appError.retry) {
        throw error;
      }

      // 마지막 시도가 아니면 대기 후 재시도
      if (attempt < maxRetries) {
        console.log(`[${context}] 재시도 ${attempt + 1}/${maxRetries}...`);
        await new Promise(resolve => setTimeout(resolve, delayMs * (attempt + 1)));
      }
    }
  }

  throw lastError;
}
