
import { toast } from './eventBus';

describe('eventBus (toast)', () => {
    const dispatchSpy = vi.spyOn(window, 'dispatchEvent');

    afterEach(() => {
        vi.clearAllMocks();
    });

    it('show dispatches CustomEvent with correct details', () => {
        toast.show('Test Message', 'success', 1000);
        
        expect(dispatchSpy).toHaveBeenCalledTimes(1);
        const event = dispatchSpy.mock.calls[0][0] as CustomEvent;
        expect(event.type).toBe('show-toast');
        expect(event.detail).toEqual(expect.objectContaining({
            message: 'Test Message',
            type: 'success',
            duration: 1000
        }));
        expect(event.detail.id).toBeTypeOf('string');
    });

    it('show uses defaults', () => {
        toast.show('Default');
        expect(dispatchSpy).toHaveBeenCalled();
        const event = dispatchSpy.mock.calls[0][0] as CustomEvent;
        expect(event.detail.type).toBe('info');
        expect(event.detail.duration).toBe(4000);
    });

    it('success helper works', () => {
        const spy = vi.spyOn(toast, 'show');
        toast.success('Success');
        expect(spy).toHaveBeenCalledWith('Success', 'success');
    });

    it('error helper works', () => {
        const spy = vi.spyOn(toast, 'show');
        toast.error('Error');
        expect(spy).toHaveBeenCalledWith('Error', 'error', 6000);
    });

    it('info helper works', () => {
        const spy = vi.spyOn(toast, 'show');
        toast.info('Info');
        expect(spy).toHaveBeenCalledWith('Info', 'info');
    });

    it('loading helper works', () => {
        const spy = vi.spyOn(toast, 'show');
        toast.loading('Loading');
        expect(spy).toHaveBeenCalledWith('Loading', 'loading', 0);
    });
});
