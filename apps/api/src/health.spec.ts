import { HealthController } from './controllers';
describe('HealthController',()=>{it('returns healthy service metadata',()=>{const result=new HealthController().health();expect(result.status).toBe('ok');expect(result.service).toBe('sami-nonak-api')})});
