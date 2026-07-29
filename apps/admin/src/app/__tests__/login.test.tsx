import { act, render } from '@testing-library/react-native';

const mockReplace = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({
    replace: mockReplace,
  }),
}));

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => {
      const translations: Record<string, string> = {
        'login.title': 'SONORA ADMIN',
        'login.subtitle': 'Enter your API Admin Key to manage translations.',
        'login.keyLabel': 'API Admin Key',
        'login.placeholder': 'bearer_token_key...',
        'login.loginBtn': 'Log in',
        'login.errorEmpty': 'Please enter your API Key',
        'login.errorInvalid': 'Invalid API key. Please check it and try again.',
        'login.keyInputLabel': 'API Admin Key input',
        'login.loginBtnLabel': 'Log in button',
      };
      return translations[key] || key;
    },
    i18n: { language: 'en' },
  }),
}));

jest.mock('@/tw', () => {
  const React = jest.requireActual('react');
  const h = React.createElement;
  return {
    TwView: (props: Record<string, unknown>) => h('View', props, props.children),
    TwPressable: (props: Record<string, unknown>) =>
      h('TouchableOpacity', { ...props, onClick: props.onPress }, props.children),
    TwTextInput: (props: Record<string, unknown>) => h('TextInput', props),
    TwText: (props: Record<string, unknown>) => h('Text', props, props.children),
    TwScrollView: (props: Record<string, unknown>) => h('ScrollView', props, props.children),
  };
});

const mockLogin = jest.fn().mockResolvedValue(true);

jest.mock('@/context/auth-context', () => ({
  useAuth: () => ({
    login: mockLogin,
    logout: jest.fn(),
    isAuthenticated: false,
    isLoading: false,
  }),
}));

import LoginScreen from '../login';

describe('LoginScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders correctly', async () => {
    const { getByPlaceholderText, getByTestId, getByText } = await render(<LoginScreen />);

    expect(getByText('SONORA ADMIN')).toBeTruthy();
    expect(getByText('API Admin Key')).toBeTruthy();
    expect(getByPlaceholderText('bearer_token_key...')).toBeTruthy();
    expect(getByTestId('login-button')).toBeTruthy();
  });

  it('shows error message if key is submitted empty', async () => {
    const { getByTestId, getByText } = await render(<LoginScreen />);

    const button = getByTestId('login-button');

    await act(async () => {
      button.props.onClick();
    });

    expect(getByText('Please enter your API Key')).toBeTruthy();
    expect(mockLogin).not.toHaveBeenCalled();
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it('authenticates session and redirects on valid input submit', async () => {
    const { getByPlaceholderText, getByTestId } = await render(<LoginScreen />);

    const input = getByPlaceholderText('bearer_token_key...');
    const button = getByTestId('login-button');

    await act(async () => {
      input.props.onChangeText('test-secret-api-key');
    });

    await act(async () => {
      button.props.onClick();
    });

    expect(mockLogin).toHaveBeenCalledWith('test-secret-api-key');
    expect(mockReplace).toHaveBeenCalledWith('/');
  });

  it('shows error if API key is invalid', async () => {
    mockLogin.mockResolvedValueOnce(false);
    const { getByPlaceholderText, getByTestId, getByText } = await render(<LoginScreen />);

    const input = getByPlaceholderText('bearer_token_key...');
    const button = getByTestId('login-button');

    await act(async () => {
      input.props.onChangeText('wrong-api-key');
    });

    await act(async () => {
      button.props.onClick();
    });

    expect(getByText('Invalid API key. Please check it and try again.')).toBeTruthy();
    expect(mockReplace).not.toHaveBeenCalled();
  });
});
