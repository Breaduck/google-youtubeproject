# Billing Gate: 외부 API 도입 전 필수 확인 사항

**목적:** 외부 API 연동 시 사용자에게 예상치 못한 과금을 방지하고, 투명한 비용 안내를 제공하기 위한 체크리스트.

---

## Runware API

### a) Video Inference 최소 잔액/Paid Invoice 조건

**현황 (2026-02-21 기준):**
- API 에러 메시지: "Video Inference requires a paid invoice or at least **$5 credit**"
- 실제 테스트 결과: $5 미만 잔액 시 `videoInferenceInsufficientCredits` 에러 발생
- 출처: 자체 테스트 (API 에러 응답)

> **⚠️ 주의:** API는 $5라고 하지만, 실제 충전은 최소 $20부터만 가능 (아래 참조)

### b) Wallet 최소 Top-Up 금액

**공식 정책:**
- **최소 충전 금액: $20**
- 이유: "to help streamline operations and maintain a high-quality experience for all users—especially as the majority of our customers are business and enterprise users"
- 출처: [Why is the minimum top-up amount $20?](https://help.runware.ai/why-is-the-minimum-top-up-amount-20)

> "The minimum credit top-up for Runware is **$20**. Credits you purchase do not expire, so even a $20 top-up can be used at your own pace."

### c) 무료 크레딧의 비디오 적용 여부

**공식 정책:**
- **신규 사용자: $10 무료 크레딧 제공**
- 비디오 생성에 적용 가능 여부: **문서에 명시 없음** (확인 필요)
- 출처: [Runware Pricing](https://runware.ai/pricing)

> "New users receive **$10 in free credits** to explore the platform and test various models."

**⚠️ 검증 필요:** 무료 크레딧으로 video inference 가능한지 실제 테스트 필요. API 에러 메시지에 "paid invoice or at least $5 credit"라고 명시되어 있어, 무료 크레딧 제외 가능성 있음.

### d) 환불/출금/만료 정책

**환불:**
- **환불은 현금이 아닌 크레딧 형태로만 제공** (재량적 판단)
- 출처: [Runware Terms](https://runware.ai/terms)

> "Refunds (if any) will be at the Company's discretion and will only be in the form of credit."

**만료:**
- **구매한 크레딧은 만료되지 않음**
- 출처: [Do credits or funds expire?](https://help.runware.ai/do-credits-or-funds-expire)

> "Your purchased credits **do not expire** and remain available in your account until used."

**출금:**
- **출금 불가** (크레딧은 계정에 고정됨)

### e) 최소 과금 단위 (반올림)

**현황:**
- 문서에 명시 없음
- Video inference 가격: **$0.14/video** (seedance-1.0-pro-fast 기준)
- 출처: [Lowest cost AI video generation now on Runware](https://runware.ai/blog/lowest-cost-ai-video-generation-now-on-runware)

### f) 사용량/비용 확인 방법

**Dashboard:**
- https://my.runware.ai/wallet

**API Endpoint:**
- 문서에 명시 없음 (Dashboard만 제공)

---

## BytePlus ModelArk API

### a) Video Inference 최소 잔액/Paid Invoice 조건

**현황:**
- **최소 잔액 요구 사항 없음** (토큰 소진 시까지 사용 가능)
- 종량제 기반 (Token 단위 과금)
- 출처: [Pricing--ModelArk](https://docs.byteplus.com/en/docs/ModelArk/1544106)

> "Asynchronous video generation billing is based on the token equivalent of the output video, calculated as: Inference Cost = Token Unit Price × Video Token Consumption."

### b) Wallet 최소 Top-Up 금액

**현황:**
- 문서에 명시 없음
- Plan 기반 결제 또는 종량제 선택 가능
- 출처: [Model Service Billing](https://docs.byteplus.com/en/docs/ModelArk/1099320)

**⚠️ 검증 필요:** BytePlus 계정 생성 후 최소 충전 금액 확인 필요.

### c) 무료 크레딧의 비디오 적용 여부

**공식 정책:**
- **Seedance: 2M 토큰 무료 제공**
- **ModelArk: 5M 토큰 무료** (Data Collaboration Rewards Campaign, ~2026-03-31)
- **비디오 생성 적용: 명시적 확인됨**
- 출처: [BytePlus Free Trial](https://www.byteplus.com/en/activity/free)

> "ModelArk offers **5M Tokens** and users can earn up to 5M tokens daily per model by joining the Data Collaboration Rewards Campaign by March 31, 2026."

> "For Seedance, you can get **2M tokens for free**."

### d) 환불/출금/만료 정책

**환불:**
- **Plan 구매 후 환불 불가**
- 출처: [Exclusive offer for new users](https://docs.byteplus.com/en/docs/ModelArk/1928220)

> "Refunds are not supported after purchasing a plan, though you may use the service within the current billing cycle."

**만료:**
- **쿠폰: 발급일로부터 90일**
- **Plan 크레딧: 문서에 명시 없음**
- 출처: [Exclusive offer for new users](https://docs.byteplus.com/en/docs/ModelArk/1928220)

> "Each coupon is valid for **90 days** from the issuance date and is non-transferable, non-refundable, and cannot be extended."

**출금:**
- **출금 불가** (크레딧 형태로만 유지)

### e) 최소 과금 단위 (반올림)

**공식 정책:**
- **Token 기반 과금** (소수점 처리 방식은 문서에 명시 없음)
- Seedance 1.0/1.5 Pro: **$2.5/M Tokens** (image-to-video)
- 토큰 계산: `(Width × Height × FPS × Duration) / 1024`
- 출처: [Pricing--ModelArk](https://docs.byteplus.com/en/docs/ModelArk/1544106)

> "For specific models like Seedance, text-to-video and image-to-video are priced the same at **2.5 USD/M Tokens**."

### f) 사용량/비용 확인 방법

**Dashboard:**
- https://console.byteplus.com/modelark

**API Endpoint:**
- 문서에 명시 없음 (Dashboard 사용 권장)

---

## Billing Gate 체크리스트

새로운 외부 API를 도입하기 전, 다음 항목을 **반드시** 확인하고 문서화할 것:

- [ ] **최소 잔액 조건**: API 호출에 필요한 최소 크레딧/잔액
- [ ] **최소 충전 금액**: 사용자가 실제로 충전해야 하는 최소 금액
- [ ] **무료 크레딧 적용 범위**: 무료 크레딧이 해당 기능에 사용 가능한지
- [ ] **환불 정책**: 환불 가능 여부 및 조건
- [ ] **만료 정책**: 크레딧/쿠폰 만료 기간
- [ ] **최소 과금 단위**: 반올림/절사 방식
- [ ] **사용량 확인 방법**: Dashboard URL 또는 API 엔드포인트

---

## 코드 구현 가이드

### 1. Feature Flag로 Provider 비활성화

```typescript
// .env
RUNWARE_ENABLED=false  // 기본값: false (명시적 활성화 필요)
```

```typescript
// videoService.ts
if (engine === 'runware') {
  if (!import.meta.env.VITE_RUNWARE_ENABLED) {
    throw new Error('Runware is disabled. Set VITE_RUNWARE_ENABLED=true in .env to enable.');
  }
  // ... Runware 호출
}
```

### 2. 안내 메시지에 명시적 비용 정보 포함

```typescript
const billingError: any = new Error(
  `⚠️ Runware 크레딧 부족\n\n` +
  `• API 최소 요구: $5 크레딧 또는 paid invoice\n` +
  `• 실제 최소 충전: $20 (공식 정책)\n` +
  `• 충전 페이지: https://my.runware.ai/wallet`
);
billingError.isBillingError = true;
billingError.need_min_credit_usd = 5;
billingError.min_topup_usd = 20;
```

### 3. Insufficient Credits 시 재시도 금지

```typescript
if (creditError) {
  console.error('[BILLING] insufficient credits - ABORT');
  throw billingError;  // 즉시 실패 처리 (재시도 없음)
}
```

---

## 참고 자료

### Runware
- [Pricing](https://runware.ai/pricing)
- [Why is the minimum top-up $20?](https://help.runware.ai/why-is-the-minimum-top-up-amount-20)
- [Do credits expire?](https://help.runware.ai/do-credits-or-funds-expire)
- [Video Inference API](https://runware.ai/docs/video-inference/api-reference)

### BytePlus ModelArk
- [Pricing](https://docs.byteplus.com/en/docs/ModelArk/1544106)
- [Free Trial](https://www.byteplus.com/en/activity/free)
- [Model Service Billing](https://docs.byteplus.com/en/docs/ModelArk/1099320)
- [Exclusive Offers](https://docs.byteplus.com/en/docs/ModelArk/1928220)

---

**마지막 업데이트:** 2026-02-21
**검증 필요 항목:**
- [ ] Runware 무료 크레딧으로 video inference 가능 여부
- [ ] BytePlus 최소 충전 금액 (계정 생성 후 확인)
