import { z } from 'zod';
import { administrationId } from '../administration/schema';

export const projectDependencyParams = z.object({ id: administrationId, blockingId: administrationId }).strict();
export type ProjectDependency = {
  id: string;
  project: { id: string; name: string };
};
export type DirectProjectDependencies = { blockedBy: ProjectDependency[]; blocking: ProjectDependency[] };
