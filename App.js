import React, {Component} from 'react';
import {
  View,
  Button,
  Text,
  TextInput,
  Image,
  ScrollView,
  StatusBar,
  TouchableHighlight,
  StyleSheet,
  Alert,
} from 'react-native';

import firebase from 'react-native-firebase';
import {Header} from 'react-native/Libraries/NewAppScreen';
import {AccessToken, LoginManager} from 'react-native-fbsdk';
import {GoogleSignin} from '@react-native-community/google-signin';
import * as Keychain from 'react-native-keychain';
import TouchID from 'react-native-touch-id';

const optionalConfigObject = {
  title: 'Authentication Required', // Android
  imageColor: '#e00606', // Android
  imageErrorColor: '#ff0000', // Android
  sensorDescription: 'Touch sensor', // Android
  sensorErrorDescription: 'Failed', // Android
  cancelText: 'Cancel', // Android
  fallbackLabel: 'Show Passcode', // iOS (if empty, then label is hidden)
  unifiedErrors: false, // use unified error messages (default false)
  passcodeFallback: false, // iOS - allows the device to fall back to using the passcode, if faceid/touch is not available. this does not mean that if touchid/faceid fails the first few times it will revert to passcode, rather that if the former are not enrolled, then it will use the passcode.
};

const successImageUri =
  'https://cdn.pixabay.com/photo/2015/06/09/16/12/icon-803718_1280.png';

export default class App extends Component {
  constructor(props) {
    super(props);
    this.unsubscribe = null;
    this.state = {
      user: null,
      message: '',
      codeInput: '',
      phoneNumber: '+1',
      confirmResult: null,
      biometryType: null,
      creds: null,
    };
  }

  componentDidMount() {
    TouchID.isSupported()
      .then(biometryType => {
        this.setState({biometryType});
        console.log('biometryType', biometryType);
        return this.loginWithBio();
      })
      .then(response => {
        console.log(response);
      })
      .catch(error => {
        console.log(error);
      });
    GoogleSignin.configure({
      scopes: ['https://www.googleapis.com/auth/userinfo.profile'],
      webClientId:
        '180370368538-g2hcmp0lj83p511lbklmt547hcbrf78e.apps.googleusercontent.com', // required
    });

    this.unsubscribe = firebase.auth().onAuthStateChanged(user => {
      if (user) {
        this.setState({user: user.toJSON()});
      } else {
        // User has been signed out, reset the state
        this.setState({
          user: null,
          message: '',
          codeInput: '',
          phoneNumber: '+1',
          confirmResult: null,
        });
      }
    });

    firebase
      .auth()
      .currentUser?.getIdToken()
      .then(tokeId => {
        console.log('token id 111: ', tokeId);
      })
      .catch(error => {
        console.log('*** error', error);
      });
    firebase
      .auth()
      .currentUser?.getIdTokenResult()
      .then(tokeId => {
        console.log('token id: ', tokeId.token);
      })
      .catch(error => {
        console.log('*** error', error);
      });
  }

  componentWillUnmount() {
    if (this.unsubscribe) {
      this.unsubscribe();
    }
  }

  loginWithBio = () => {
    Keychain.getGenericPassword()
      .then(creds => {
        if (creds) {
          console.log(
            'Credentials successfully loaded for user ' + creds.username,
            creds.password,
            creds,
          );
          this.setState({creds});
        } else {
          console.log('No credentials stored');
          const err = Error('No credentials stored');
          err.code = 400;
          throw err;
        }
      })
      .catch(error => {
        if (error.code === 400) {
          Keychain.setInternetCredentials('sipscince_prod', '1', '111');
        }
        console.log(error);
      });
  };

  facebookLogin = () => {
    LoginManager.logInWithPermissions(['public_profile', 'email'])
      .then(result => {
        if (result.isCancelled) {
          // handle this however suites the flow of your app
          throw new Error('User cancelled request');
        }
        return AccessToken.getCurrentAccessToken();
      })
      .then(data => {
        console.log(data);
        if (!data) {
          throw new Error('Something went wrong obtaining access token');
        }
        return firebase.auth.FacebookAuthProvider.credential(data.accessToken);
      })
      .then(credential => {
        return firebase.auth().signInWithCredential(credential);
      })
      .then(response => {
        console.log(response);
        return response.user.getIdTokenResult(true);
      })
      .then(tokeId => {
        console.log('token id: ', tokeId.token);
      })
      .catch(error => {
        console.log(error, error.code, error.data);
      });
  };

  googleLogin = () => {
    GoogleSignin.signIn()
      .then(({accessToken, idToken}) => {
        return firebase.auth.GoogleAuthProvider.credential(
          idToken,
          accessToken,
        );
      })
      .then(credential => {
        return firebase.auth().signInWithCredential(credential);
      })
      .then(response => {
        console.log(response);
        return response.user.getIdTokenResult(true);
      })
      .then(tokeId => {
        console.log('token id: ', tokeId.token);
      })
      .catch(error => {
        console.log(error);
      });
  };
  phoneLogin = () => {
    const {phoneNumber} = this.state;
    this.setState({message: 'Sending code ...'});

    firebase
      .auth()
      .signInWithPhoneNumber(phoneNumber)
      .then(confirmResult =>
        this.setState({confirmResult, message: 'Code has been sent!'}),
      )
      .catch(error =>
        this.setState({
          message: `Sign In With Phone Number Error: ${error.message}`,
        }),
      );
  };

  confirmCode = () => {
    const {codeInput, confirmResult} = this.state;

    if (confirmResult && codeInput.length) {
      confirmResult
        .confirm(codeInput)
        .then(user => {
          this.setState({message: 'Code Confirmed!'});
        })
        .catch(error =>
          this.setState({message: `Code Confirm Error: ${error.message}`}),
        );
    }
  };

  signOut = () => {
    firebase.auth().signOut();
  };

  renderPhoneNumberInput() {
    const {phoneNumber} = this.state;

    return (
      <View style={{padding: 25}}>
        <Text>Enter phone number:</Text>
        <TextInput
          autoFocus
          style={{height: 40, marginTop: 15, marginBottom: 15}}
          onChangeText={value => this.setState({phoneNumber: value})}
          placeholder={'Phone number ... '}
          value={phoneNumber}
        />
        <Button title="Sign In" color="green" onPress={this.phoneLogin} />
      </View>
    );
  }

  renderMessage() {
    const {message} = this.state;

    if (!message.length) {
      return null;
    }

    return (
      <Text style={{padding: 5, backgroundColor: '#000', color: '#fff'}}>
        {message}
      </Text>
    );
  }

  renderVerificationCodeInput() {
    const {codeInput} = this.state;

    return (
      <View style={{marginTop: 25, padding: 25}}>
        <Text>Enter verification code below:</Text>
        <TextInput
          autoFocus
          style={{height: 40, marginTop: 15, marginBottom: 15}}
          onChangeText={value => this.setState({codeInput: value})}
          placeholder={'Code ... '}
          value={codeInput}
        />
        <Button
          title="Confirm Code"
          color="#841584"
          onPress={this.confirmCode}
        />
      </View>
    );
  }

  localAuthHandler = () => {
    TouchID.isSupported(optionalConfigObject)
      .then(biometryType => {
        if (biometryType === 'FaceID') {
          console.log('FaceID is supported.');
        } else if (biometryType === 'TouchID') {
          console.log('TouchID is supported.');
        } else if (biometryType === true) {
          // Touch ID is supported on Android
        }

        return TouchID.authenticate();
      })
      .then(response => {
        console.log(response);
        return Keychain.setGenericPassword('1', '1234');
      })
      .then(ok => {
        if (!ok) {
          throw Error('Set creds error');
        }
        return Keychain.getGenericPassword();
      })
      .then(creds => {
        console.log('creds', creds);
        this.setState({creds});
      })
      .catch(error => {
        console.log(error);
        Alert.alert('TouchID not supported', error);
      });
  };

  resetKeychain = () => {
    Keychain.resetGenericPassword()
      .then(ok => {
        if (!ok) {
          throw Error('reset error');
        }
        return Keychain.getGenericPassword();
      })
      .then(creds => {
        if (creds) {
          this.setState({creds});
        } else {
          this.setState({creds: null});
        }
      })
      .catch(error => {
        console.log(error);
      });
  };
  renderTouchView() {
    return (
      <View>
        <Button
          title={`Authenticate with ${this.state.biometryType}`}
          onPress={this.localAuthHandler}
        />

        <Button title={'Reset keychain'} onPress={this.resetKeychain} />
      </View>
    );
  }

  render() {
    const {user, confirmResult} = this.state;
    return (
      <React.Fragment>
        <View style={{height: 44}} />
        <ScrollView style={styles.container}>
          <Button
            title="Facebook Login"
            style={{pading: 15}}
            onPress={this.facebookLogin}
          />

          <Button
            title="Google Login"
            style={{pading: 15}}
            onPress={this.googleLogin}
          />

          {this.state.biometryType && this.renderTouchView()}

          {this.state.creds != null && (
            <Text>{JSON.stringify(this.state.creds)}</Text>
          )}

          {!user && !confirmResult && this.renderPhoneNumberInput()}

          {this.renderMessage()}

          {!user && confirmResult && this.renderVerificationCodeInput()}

          {user && (
            <View
              style={{
                padding: 15,
                justifyContent: 'center',
                alignItems: 'center',
                backgroundColor: '#77dd77',
                flex: 1,
              }}>
              <Image
                source={{uri: successImageUri}}
                style={{width: 100, height: 100, marginBottom: 25}}
              />
              <Text style={{fontSize: 25}}>Signed In!</Text>
              <Text>{JSON.stringify(user)}</Text>
              <Button title="Sign Out" color="red" onPress={this.signOut} />
            </View>
          )}
        </ScrollView>
      </React.Fragment>
    );
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5FCFF',
  },
  btn: {
    borderRadius: 3,
    marginTop: 30,
    marginBottom: 30,
    paddingTop: 15,
    paddingBottom: 15,
    paddingLeft: 15,
    paddingRight: 15,
    backgroundColor: '#0391D7',
  },
});
