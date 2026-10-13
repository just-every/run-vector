export class IntegrationError extends Error {
 constructor(readonly status:400|401|403|404|409|410|413|429|503,readonly code:string,message=code){super(message);}
}
