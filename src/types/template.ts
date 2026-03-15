export interface StyleTemplate {
  id: string;
  category: '실사' | '장르성 캐릭터' | '일러스트' | '애니메이션' | '전통화';
  name: string;
  thumbnail: string;
  imagePromptPrefix: string;
  negativePrompt: string;
}

export type TemplateCategory = '실사' | '장르성 캐릭터' | '일러스트' | '애니메이션' | '전통화';
