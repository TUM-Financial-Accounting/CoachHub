import { apiClient } from './api-client';
import { Exercise, Basic, Principle, Tactic } from '../types/models';
import {
    mapExerciseFromApi, mapBasicFromApi, mapPrincipleFromApi, mapTacticFromApi,
    mapExerciseToApi, mapBasicToApi, mapPrincipleToApi, mapTacticToApi,
} from '../lib/data-mappers';

export interface PlaybookData {
    exercises: Exercise[];
    basics: Basic[];
    principles: Principle[];
    tactics: Tactic[];
}

interface RawPlaybookData {
    exercises: any[];
    basics: any[];
    principles: any[];
    tactics: any[];
}

export const PlaybookService = {
    async exportPlaybook(): Promise<PlaybookData> {
        const raw = await apiClient.get<RawPlaybookData>('/playbook/export');
        return {
            exercises: (raw.exercises || []).map(mapExerciseFromApi),
            basics: (raw.basics || []).map(mapBasicFromApi),
            principles: (raw.principles || []).map(mapPrincipleFromApi),
            tactics: (raw.tactics || []).map(mapTacticFromApi),
        };
    },

    async importPlaybook(data: PlaybookData): Promise<{ message: string }> {
        return await apiClient.post('/playbook/import', {
            exercises: data.exercises.map(mapExerciseToApi),
            basics: data.basics.map(mapBasicToApi),
            principles: data.principles.map(mapPrincipleToApi),
            tactics: data.tactics.map(mapTacticToApi),
        });
    }
};
