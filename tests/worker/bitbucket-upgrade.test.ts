import {it} from 'vitest';
import {provePopulatedUpgrade} from './populated-upgrade';

it('a populated installation upgrades additively with Bitbucket custody and existing data intact',async()=>provePopulatedUpgrade('0126_bitbucket_pull_requests.sql',{added:['table vector_bitbucket_repositories','table vector_bitbucket_pull_requests','table vector_bitbucket_issue_links','table vector_bitbucket_deliveries','index vector_bitbucket_links_issue'],removed:[],until:'0126_bitbucket_pull_requests.sql'},['issues','operators','issue_comments','issue_files','oa_sessions']),120000);
