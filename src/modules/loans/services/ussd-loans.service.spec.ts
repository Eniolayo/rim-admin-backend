import { Test, TestingModule } from '@nestjs/testing';
import { UssdLoansService } from './ussd-loans.service';
import { User } from '../../../entities/user.entity';
import { Loan } from '../../../entities/loan.entity';
import { CreditScoreService } from '../../credit-score/services/credit-score.service';
import { UssdSessionService } from './ussd-session.service';
import { SystemConfigService } from '../../system-config/services/system-config.service';
import { Logger } from 'nestjs-pino';
import { normalizeNigerianPhone } from '../../../common/utils/phone.utils';
import { UserRepository } from '../../users/repositories/user.repository';

describe('UssdLoansService', () => {
  let service: UssdLoansService;
  let userRepo: UserRepository;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UssdLoansService,
        {
          provide: UserRepository,
          useValue: {
            findByPhone: jest.fn(),
          },
        },
        {
          provide: CreditScoreService,
          useValue: {
            calculateEligibleLoanAmount: jest.fn(),
            calculateInterestRateByCreditScore: jest.fn(),
            calculateRepaymentPeriodByCreditScore: jest.fn(),
          },
        },
        {
          provide: UssdSessionService,
          useValue: {
            saveOfferSession: jest.fn(),
            getOfferSession: jest.fn(),
          },
        },
        {
          provide: SystemConfigService,
          useValue: {},
        },
        {
          provide: Logger,
          useValue: {
            log: jest.fn(),
            debug: jest.fn(),
            warn: jest.fn(),
            error: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<UssdLoansService>(UssdLoansService);
    userRepo = module.get<UserRepository>(UserRepository);
  });

  it('should return error text for invalid offer request', async () => {
    const result = await service.handleLoanOffer({
      phoneNumber: '',
      sessionId: '',
      responseType: 'text',
    } as any);

    expect(result).toBe('END Invalid request.');
  });

  it('should return error when user not found on offer', async () => {
    jest.spyOn(userRepo, 'findByPhone').mockResolvedValue(null as any);

    const result = (await service.handleLoanOffer({
      phoneNumber: '0801',
      sessionId: 'sess-1',
      responseType: 'json',
    } as any)) as any;

    expect(result.status).toBe('error');
    expect(result.code).toBe('USER_NOT_FOUND');
  });

  it('should normalize phone number formats consistently to local format', () => {
    expect(normalizeNigerianPhone('07030278896')).toBe('07030278896');
    expect(normalizeNigerianPhone('+2347030278896')).toBe('07030278896');
    expect(normalizeNigerianPhone('2347030278896')).toBe('07030278896');
  });
});


