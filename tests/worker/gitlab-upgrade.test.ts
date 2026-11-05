import {it} from 'vitest';
import {provePopulatedUpgrade} from './populated-upgrade';
it('GitLab additive setup preserves a populated installation and native archive inventory',async()=>provePopulatedUpgrade('0126_gitlab_setup.sql',{added:['table vector_gitlab_connections','table vector_gitlab_projects','table vector_gitlab_hooks'],removed:[],until:'0126_gitlab_setup.sql',signIn:'after'},['issues','operators','issue_comments','issue_files']),120000);
