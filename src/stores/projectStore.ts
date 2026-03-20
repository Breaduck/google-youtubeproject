import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { StoryProject, SavedStyle, SavedCharacter } from '../types';

const EXP_TEST_PROJECT_ID = 'exp-official-sdk-test-pid';
const EXP_TEST_PROJECT: StoryProject = {
  id: EXP_TEST_PROJECT_ID,
  title: '소금 장인의 숨겨진 진실',
  script: '노년의 소금 장인 박씨가 평생 지켜온 비밀이 밝혀지는 이야기.',
  style: 'realistic',
  characters: [],
  scenes: [
    {
      id: 'exp-scene-1',
      scriptSegment: '아버님! 그건 아버님이 만든 소금이 아니잖아요!',
      imagePrompt: '한국 드라마 실내 장면, 감정적인 대화',
      imageUrl: null,
      audioUrl: null,
      videoUrl: null,
      status: 'idle',
      audioStatus: 'idle',
      videoStatus: 'idle',
    },
  ],
  updatedAt: Date.now(),
};

interface ProjectStore {
  // Projects
  projects: StoryProject[];
  currentProjectId: string | null;

  // Saved Styles & Characters
  savedStyles: SavedStyle[];
  savedCharacters: SavedCharacter[];

  // Project Actions
  setProjects: (projects: StoryProject[]) => void;
  addProject: (project: StoryProject) => void;
  updateProject: (id: string, updates: Partial<StoryProject>) => void;
  deleteProject: (id: string) => void;
  setCurrentProjectId: (id: string | null) => void;

  // Helper: Get current project
  getCurrentProject: () => StoryProject | null;

  // Saved Styles Actions
  setSavedStyles: (styles: SavedStyle[]) => void;
  addSavedStyle: (style: SavedStyle) => void;
  deleteSavedStyle: (id: string) => void;

  // Saved Characters Actions
  setSavedCharacters: (characters: SavedCharacter[]) => void;
  addSavedCharacter: (character: SavedCharacter) => void;
  deleteSavedCharacter: (id: string) => void;
}

export const useProjectStore = create<ProjectStore>()(
  persist(
    (set, get) => ({
      // Initial state
      projects: [EXP_TEST_PROJECT],
      currentProjectId: null,
      savedStyles: [],
      savedCharacters: [],

      // Project Actions
      setProjects: (projects) => set({ projects }),

      addProject: (project) =>
        set((state) => ({
          projects: [...state.projects, project],
        })),

      updateProject: (id, updates) =>
        set((state) => ({
          projects: state.projects.map((p) =>
            p.id === id ? { ...p, ...updates, updatedAt: Date.now() } : p
          ),
        })),

      deleteProject: (id) =>
        set((state) => ({
          projects: state.projects.filter((p) => p.id !== id),
          currentProjectId: state.currentProjectId === id ? null : state.currentProjectId,
        })),

      setCurrentProjectId: (id) => set({ currentProjectId: id }),

      getCurrentProject: () => {
        const state = get();
        return state.projects.find((p) => p.id === state.currentProjectId) || null;
      },

      // Saved Styles Actions
      setSavedStyles: (styles) => set({ savedStyles: styles }),

      addSavedStyle: (style) =>
        set((state) => ({
          savedStyles: [...state.savedStyles, style],
        })),

      deleteSavedStyle: (id) =>
        set((state) => ({
          savedStyles: state.savedStyles.filter((s) => s.id !== id),
        })),

      // Saved Characters Actions
      setSavedCharacters: (characters) => set({ savedCharacters: characters }),

      addSavedCharacter: (character) =>
        set((state) => ({
          savedCharacters: [...state.savedCharacters, character],
        })),

      deleteSavedCharacter: (id) =>
        set((state) => ({
          savedCharacters: state.savedCharacters.filter((c) => c.id !== id),
        })),
    }),
    {
      name: 'user_projects_v1',
      partialize: (state) => ({
        projects: state.projects,
        currentProjectId: state.currentProjectId,
        savedStyles: state.savedStyles,
        savedCharacters: state.savedCharacters,
      }),
    }
  )
);
