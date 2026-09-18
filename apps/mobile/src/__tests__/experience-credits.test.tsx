import { render } from '@testing-library/react-native';
import { ExperienceCredits } from '@/components/experience-credits';
import type { ExperienceCredit } from '@sonora/shared';

jest.mock('@/hooks/use-translation', () => ({
  useAppTranslation: () => ({
    t: (key: string, options?: { defaultValue?: string }) => {
      if (key === 'experiences.credits') return 'Créditos';
      if (key === 'experiences.creditRoles.realization') return 'Realización';
      if (key === 'experiences.creditRoles.musicalEditing') return 'Edición musical';
      return options?.defaultValue ?? key;
    },
  }),
}));

jest.mock('@/hooks/use-theme-colors', () => ({
  useThemeColors: () => ({
    homeCardText: '#111827',
    homeCardSubtext: '#6b7280',
    border: 'rgba(0,0,0,0.1)',
  }),
}));

describe('ExperienceCredits component', () => {
  const sampleCreditsWithKeys: ExperienceCredit[] = [
    { role: 'realization', names: 'Grupo Arquitectura del juego' },
    { role: 'musicalEditing', names: 'Max Delanian' },
  ];

  const sampleCreditsWithCustomRole: ExperienceCredit[] = [
    { role: 'Custom Role', names: 'Artistic Contributor' },
  ];

  it('renders nothing if credits is undefined or null', async () => {
    const { queryByTestId: query1 } = await render(<ExperienceCredits credits={undefined} />);
    expect(query1('experience-credits')).toBeNull();

    const { queryByTestId: query2 } = await render(<ExperienceCredits credits={null} />);
    expect(query2('experience-credits')).toBeNull();
  });

  it('renders nothing if credits is an empty array', async () => {
    const { queryByTestId } = await render(<ExperienceCredits credits={[]} />);
    expect(queryByTestId('experience-credits')).toBeNull();
  });

  it('translates known role keys into localized strings', async () => {
    const { getByTestId, getByText } = await render(
      <ExperienceCredits credits={sampleCreditsWithKeys} />,
    );

    expect(getByTestId('experience-credits')).toBeTruthy();
    expect(getByText('Créditos')).toBeTruthy();
    expect(getByText('Realización')).toBeTruthy();
    expect(getByText('Grupo Arquitectura del juego')).toBeTruthy();
    expect(getByText('Edición musical')).toBeTruthy();
    expect(getByText('Max Delanian')).toBeTruthy();
  });

  it('falls back to custom role name when no translation key exists', async () => {
    const { getByText } = await render(<ExperienceCredits credits={sampleCreditsWithCustomRole} />);

    expect(getByText('Custom Role')).toBeTruthy();
    expect(getByText('Artistic Contributor')).toBeTruthy();
  });
});
