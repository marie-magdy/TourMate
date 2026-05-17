import React from 'react';
import { Alert } from 'react-native';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import Confirmation from '../app/(auth)/confirmation';
import { api } from '../api';

const mockReplace = jest.fn();

jest.mock('expo-router', () => ({
  useRouter: () => ({
    replace: mockReplace,
  }),

  useLocalSearchParams: () => ({
    username: 'Habiba',
    email: 'habiba@test.com',
    userId: '123',
    token: 'token123',
  }),
}));

jest.mock('../api', () => ({
  api: {
    put: jest.fn(),
  },
}));

jest.spyOn(Alert, 'alert');

describe('Confirmation Screen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // =========================
  // Rendering
  // =========================

  it('renders initial values correctly', () => {
    const { getByDisplayValue, getByText } =
      render(<Confirmation />);

    expect(getByText('Habiba')).toBeTruthy();

    expect(
      getByDisplayValue('habiba@test.com')
    ).toBeTruthy();

    expect(
      getByDisplayValue('Habiba')
    ).toBeTruthy();

    expect(
      getByText('Save Settings')
    ).toBeTruthy();
  });


  // =========================
  // Password toggle
  // =========================

  it('shows password fields when Change pressed', () => {
    const { getByText, getByPlaceholderText } =
      render(<Confirmation />);

    fireEvent.press(
      getByText('Change')
    );

    expect(
      getByPlaceholderText(
        'Enter current password'
      )
    ).toBeTruthy();

    expect(
      getByPlaceholderText(
        'Enter new password'
      )
    ).toBeTruthy();
  });


  it('hides password fields when Cancel pressed', () => {
    const {
      getByText,
      queryByPlaceholderText,
    } = render(<Confirmation />);

    fireEvent.press(
      getByText('Change')
    );

    fireEvent.press(
      getByText('Cancel')
    );

    expect(
      queryByPlaceholderText(
        'Enter current password'
      )
    ).toBeNull();
  });


  // =========================
  // Password validation
  // =========================

  it('shows error if password fields empty', () => {
    const { getByText } =
      render(<Confirmation />);

    fireEvent.press(
      getByText('Change')
    );

    fireEvent.press(
      getByText('Save Password')
    );

    expect(Alert.alert)
      .toHaveBeenCalledWith(
        'Error',
        'Please fill in both password fields'
      );
  });


  it('shows error if new password too short', () => {
    const {
      getByText,
      getByPlaceholderText
    } = render(<Confirmation />);

    fireEvent.press(
      getByText('Change')
    );

    fireEvent.changeText(
      getByPlaceholderText(
        'Enter current password'
      ),
      'oldpass'
    );

    fireEvent.changeText(
      getByPlaceholderText(
        'Enter new password'
      ),
      '123'
    );

    fireEvent.press(
      getByText('Save Password')
    );

    expect(Alert.alert)
      .toHaveBeenCalledWith(
        'Error',
        'New password must be at least 6 characters'
      );
  });


  // =========================
  // Password success
  // =========================

  it('updates password successfully', async () => {

    (api.put as jest.Mock)
      .mockResolvedValueOnce({});

    const {
      getByText,
      getByPlaceholderText
    } = render(<Confirmation />);

    fireEvent.press(
      getByText('Change')
    );

    fireEvent.changeText(
      getByPlaceholderText(
        'Enter current password'
      ),
      'oldpassword'
    );

    fireEvent.changeText(
      getByPlaceholderText(
        'Enter new password'
      ),
      'newpassword123'
    );

    fireEvent.press(
      getByText('Save Password')
    );

    await waitFor(() => {

      expect(api.put)
        .toHaveBeenCalledWith(
          '/auth/user/123/password',
          {
            current_password:
              'oldpassword',

            new_password:
              'newpassword123',
          }
        );

    });

    expect(Alert.alert)
      .toHaveBeenCalledWith(
        'Success',
        'Password updated successfully'
      );
  });


  // =========================
  // Password API failure
  // =========================

  it('shows API error message', async () => {

    (api.put as jest.Mock)
      .mockRejectedValueOnce({
        response:{
          data:{
            message:
              'Wrong password'
          }
        }
      });

    const {
      getByText,
      getByPlaceholderText
    } = render(<Confirmation />);

    fireEvent.press(
      getByText('Change')
    );

    fireEvent.changeText(
      getByPlaceholderText(
        'Enter current password'
      ),
      'wrong'
    );

    fireEvent.changeText(
      getByPlaceholderText(
        'Enter new password'
      ),
      'newpassword'
    );

    fireEvent.press(
      getByText(
        'Save Password'
      )
    );

    await waitFor(()=>{

      expect(Alert.alert)
      .toHaveBeenCalledWith(
        'Error',
        'Wrong password'
      );

    });
  });


  // =========================
  // Password generic failure
  // =========================

  it('shows fallback password error', async()=>{

(api.put as jest.Mock)
.mockRejectedValueOnce({});

const {
getByText,
getByPlaceholderText
}=render(<Confirmation/>);

fireEvent.press(
getByText('Change')
);

fireEvent.changeText(
getByPlaceholderText(
'Enter current password'
),
'oldpassword'
);

fireEvent.changeText(
getByPlaceholderText(
'Enter new password'
),
'newpassword'
);

fireEvent.press(
getByText(
'Save Password'
)
);

await waitFor(()=>{

expect(Alert.alert)
.toHaveBeenCalledWith(
'Error',
'Failed to update password'
);

});

});



  // =========================
  // Settings validation
  // =========================

  it('shows error if username empty',()=>{

const {
getByDisplayValue,
getByText
}=render(<Confirmation/>);

fireEvent.changeText(
getByDisplayValue(
'Habiba'
),
''
);

fireEvent.press(
getByText(
'Save Settings'
)
);

expect(Alert.alert)
.toHaveBeenCalledWith(
'Error',
'Username and email are required'
);

});


it('shows error if email empty',()=>{

const {
getByDisplayValue,
getByText
}=render(<Confirmation/>);

fireEvent.changeText(
getByDisplayValue(
'habiba@test.com'
),
''
);

fireEvent.press(
getByText(
'Save Settings'
)
);

expect(Alert.alert)
.toHaveBeenCalledWith(
'Error',
'Username and email are required'
);

});



  // =========================
  // Save settings success
  // =========================

it('saves settings and navigates',async()=>{

(api.put as jest.Mock)
.mockResolvedValueOnce({});

const {
getByText
}=render(<Confirmation/>);

fireEvent.press(
getByText(
'Save Settings'
)
);

await waitFor(()=>{

expect(api.put)
.toHaveBeenCalledWith(
'/auth/user/123',
{
username:'Habiba',
email:'habiba@test.com'
}
);

});

expect(Alert.alert)
.toHaveBeenCalled();

const alertCall=
(Alert.alert as jest.Mock)
.mock.calls[0];

alertCall[2][0]
.onPress();

expect(mockReplace)
.toHaveBeenCalledWith(
'/(main)/home'
);

});



  // =========================
  // Save settings API error
  // =========================

it('shows save API message',async()=>{

(api.put as jest.Mock)
.mockRejectedValueOnce({

response:{
data:{
message:
'Email exists'
}
}

});

const {
getByText
}=render(
<Confirmation/>
);

fireEvent.press(
getByText(
'Save Settings'
)
);

await waitFor(()=>{

expect(Alert.alert)
.toHaveBeenCalledWith(
'Error',
'Email exists'
);

});

});


  // =========================
  // Generic save error
  // =========================

it('shows fallback save error',async()=>{

(api.put as jest.Mock)
.mockRejectedValueOnce({});

const {
getByText
}=render(
<Confirmation/>
);

fireEvent.press(
getByText(
'Save Settings'
)
);

await waitFor(()=>{

expect(Alert.alert)
.toHaveBeenCalledWith(
'Error',
'Failed to save settings'
);

});

});

});