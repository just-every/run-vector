import type { Hono } from "hono";
import type { AppEnvironment } from "../../app/bindings";
import { readRequestJson } from "../../app/input";
import { IntegrationError } from "../integrations/errors";
import { projectUpdateInput, updateId } from "./schema";
import { postProjectUpdate } from "./repository";

export function addProjectUpdateRoutes(app:Hono<AppEnvironment>) {
  app.post('/projects/:projectId/updates',async c=>{
    const project=updateId.safeParse(c.req.param('projectId'));
    const input=projectUpdateInput.safeParse(await readRequestJson(c.req.raw));
    if(!project.success||!input.success)throw new IntegrationError(400,'invalid_project_update');
    try {return c.json(await postProjectUpdate(c.env.DB,c.get('operatorId'),project.data,input.data),201);}
    catch(error) {
      if(error instanceof Error&&error.message.includes('project_update_conflict'))throw new IntegrationError(409,'project_update_conflict');
      if(!await c.env.DB.prepare('SELECT id FROM projects WHERE id=?').bind(project.data).first())
        throw new IntegrationError(404,'project_not_found');
      throw error;
    }
  });
}
