// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import PropTypes from 'prop-types';
import React, {PureComponent} from 'react';
import {intlShape} from 'react-intl';
import {
    ActivityIndicator,
    Dimensions,
    Image,
    InteractionManager,
    Keyboard,
    StyleSheet,
    TextInput,
    TouchableWithoutFeedback,
    View,
    Platform,
} from 'react-native';
import Button from 'react-native-button';
import {KeyboardAwareScrollView} from 'react-native-keyboard-aware-scrollview';
import {SafeAreaView} from 'react-native-safe-area-context';
import urlParse from 'url-parse';

import {resetToChannel, goToScreen} from '@actions/navigation';
import LocalConfig from '@assets/config';
import {Client4} from '@client/rest';
import ErrorText from '@components/error_text';
import FormattedText from '@components/formatted_text';
import StatusBar from '@components/status_bar';
import mattermostManaged from '@mattermost-managed';
import {t} from '@utils/i18n';
import {preventDoubleTap} from '@utils/tap';
import {changeOpacity} from '@utils/theme';
import {stripTrailingSlashes} from '@utils/url';

import mattermostBucket from 'app/mattermost_bucket';
import {GlobalStyles} from 'app/styles';

export const mfaExpectedErrors = ['mfa.validate_token.authenticate.app_error', 'ent.mfa.validate_token.authenticate.app_error'];

export default class Login extends PureComponent {
    static propTypes = {
        actions: PropTypes.shape({
            scheduleExpiredNotification: PropTypes.func.isRequired,
            login: PropTypes.func.isRequired,

            // handleServerUrlChanged: PropTypes.func,
        }).isRequired,
        config: PropTypes.object.isRequired,
        license: PropTypes.object.isRequired,
    };

    static contextTypes = {
        intl: intlShape.isRequired,
    };

    constructor(props) {
        super(props);

        this.loginRef = React.createRef();
        this.passwordRef = React.createRef();
        this.scroll = React.createRef();
        this.loginId = '';
        this.password = '';

        this.state = {
            error: null,
            isLoading: false,
            connected: false,
            connecting: false,
        };
    }

    componentDidMount() {
        console.warn("Login Url", Client4.getUrl())

        this.dimensionsListener = Dimensions.addEventListener('change', this.orientationDidChange);

        if (LocalConfig.ExperimentalClientSideCertEnable && Platform.OS === 'ios') {
            RNFetchBlob.cba.selectCertificate((certificate) => {
                if (certificate) {
                    mattermostBucket.setPreference('cert', certificate);
                    window.fetch = new RNFetchBlob.polyfill.Fetch({
                        auto: true,
                        certificate,
                    }).build();
                    this.pingServer('https://meta.wellsite.com');
                }
            });                             
        } else {
            this.pingServer('https://meta.wellsite.com');
        }

        this.setEmmUsernameIfAvailable();
    }

    componentWillUnmount() {
        this.dimensionsListener?.remove();
    }

    goToChannel = () => {
        this.scheduleSessionExpiredNotification();

        resetToChannel();
    };

    goToMfa = () => {
        const {intl} = this.context;
        const screen = 'MFA';
        const title = intl.formatMessage({id: 'mobile.routes.mfa', defaultMessage: 'Multi-factor Authentication'});
        const loginId = this.loginId;
        const password = this.password;
        goToScreen(screen, title, {goToChannel: this.goToChannel, loginId, password});
        console.warn("Token s===>>>", Client4.getToken())

    };

    blur = () => {
        if (this.loginRef.current) {
            this.loginRef.current.blur();
        }

        if (this.passwordRef.current) {
            this.passwordRef.current.blur();
        }

        Keyboard.dismiss();
    };

    checkLoginResponse = (data) => {
        if (mfaExpectedErrors.includes(data?.error?.server_error_id)) { // eslint-disable-line camelcase
            this.goToMfa();
            this.setState({isLoading: false});
            return false;
        }

        if (data?.error) {
            this.setState({
                error: this.getLoginErrorMessage(data.error),
                isLoading: false,
            });
            return false;
        }

        this.setState({isLoading: false});
        return true;
    };

    createLoginPlaceholder() {
        const {formatMessage} = this.context.intl;
        const license = this.props.license;
        const config = this.props.config;
        const loginPlaceholders = [];
        if (config.EnableSignInWithEmail === 'true') {
            loginPlaceholders.push(formatMessage({id: 'login.email', defaultMessage: 'Email'}));
        }
        if (config.EnableSignInWithEmail !== 'true') {
            loginPlaceholders.push(formatMessage({id: 'login.email', defaultMessage: 'Email'}));
        }

        if (config.EnableSignInWithUsername === 'true') {
            loginPlaceholders.push(formatMessage({id: 'login.username', defaultMessage: 'Username'}));
        }

        if (config.EnableSignInWithUsername !== 'true') {
            loginPlaceholders.push(formatMessage({id: 'login.username', defaultMessage: 'Username'}));
        }
        if (license.IsLicensed === 'true' && license.LDAP === 'true' && config.EnableLdap === 'true') {
            if (config.LdapLoginFieldName) {
                loginPlaceholders.push(config.LdapLoginFieldName);
            } else {
                loginPlaceholders.push(formatMessage({id: 'login.ldapUsername', defaultMessage: 'AD/LDAP Username'}));
            }
        }

        if (loginPlaceholders.length >= 2) {
            return loginPlaceholders.slice(0, loginPlaceholders.length - 1).join(', ') +
                ` ${formatMessage({id: 'login.or', defaultMessage: 'or'})} ` +
                loginPlaceholders[loginPlaceholders.length - 1];
        } else if (loginPlaceholders.length === 1) {
            return loginPlaceholders[0];
        }

        return '';
    }

    forgotPassword = () => {
        const {intl} = this.context;
        const screen = 'ForgotPassword';
        const title = intl.formatMessage({id: 'password_form.title', defaultMessage: 'Password Reset'});

        goToScreen(screen, title);
        console.warn("Token s===>>>22", Client4.getToken())

    };

    getLoginErrorMessage = (error) => {
        return (
            this.getServerErrorForLogin(error) ||
            this.state.error
        );
    };

    getServerErrorForLogin = (error) => {
        if (!error) {
            return null;
        }
        const errorId = error.server_error_id;
        if (!errorId) {
            return error.message;
        }
        if (
            errorId === 'store.sql_user.get_for_login.app_error' ||
            errorId === 'ent.ldap.do_login.user_not_registered.app_error'
        ) {
            return {
                intl: {
                    id: t('login.userNotFound'),
                    defaultMessage: "We couldn't find an account matching your login credentials.",
                },
            };
        } else if (
            errorId === 'api.user.check_user_password.invalid.app_error' ||
            errorId === 'ent.ldap.do_login.invalid_password.app_error'
        ) {
            return {
                intl: {
                    id: t('login.invalidPassword'),
                    defaultMessage: 'Your password is incorrect.',
                },
            };
        }
        return error.message;
    };

    handleLoginChange = (text) => {
        this.loginId = text;
    };

    handlePasswordChange = (text) => {
        this.password = text;
    };

    orientationDidChange = () => {
        if (this.scroll.current) {
            this.scroll.current.scrollTo({x: 0, y: 0, animated: true});
        }
    };

    passwordFocus = () => {
        if (this.passwordRef.current) {
            this.passwordRef.current.focus();
        }
    };

    preSignIn = preventDoubleTap(() => {
        this.setState({error: null, isLoading: true});
        Keyboard.dismiss();
        InteractionManager.runAfterInteractions(async () => {
            if (!this.loginId) {
                t('login.noEmail');
                t('login.noEmailLdapUsername');
                t('login.noEmailUsername');
                t('login.noEmailUsernameLdapUsername');
                t('login.noLdapUsername');
                t('login.noUsername');
                t('login.noUsernameLdapUsername');

                // it's slightly weird to be constructing the message ID, but it's a bit nicer than triply nested if statements
                let msgId = 'login.no';
                if (this.props.config.EnableSignInWithEmail === 'true') {
                    msgId += 'Email';
                }
                if (this.props.config.EnableSignInWithUsername === 'true') {
                    msgId += 'Username';
                }
                if (this.props.license.IsLicensed === 'true' && this.props.config.EnableLdap === 'true') {
                    msgId += 'LdapUsername';
                }

                this.setState({
                    isLoading: false,
                    error: {
                        intl: {
                            id: msgId,
                            defaultMessage: '',
                            values: {
                                ldapUsername: this.props.config.LdapLoginFieldName ||
                                    this.context.intl.formatMessage({
                                        id: 'login.ldapUsernameLower',
                                        defaultMessage: 'AD/LDAP username',
                                    }),
                            },
                        },
                    },
                });
                return;
            }

            if (!this.password) {
                this.setState({
                    isLoading: false,
                    error: {
                        intl: {
                            id: t('login.noPassword'),
                            defaultMessage: 'Please enter your password',
                        },
                    },
                });
                return;
            }

            this.signIn();
        });
    });

    scheduleSessionExpiredNotification = () => {
        const {intl} = this.context;
        const {actions} = this.props;

        actions.scheduleExpiredNotification(intl);
    };

    setEmmUsernameIfAvailable = async () => {
        const managedConfig = await mattermostManaged.getConfig();
        if (managedConfig?.username && this.loginRef.current) {
            this.loginRef.current.setNativeProps({text: managedConfig.username});
            this.loginId = managedConfig.username;
        }
    };

    signIn = async () => {
        const {actions} = this.props;
        console.log("signin1",actions)  // 99
        const {isLoading} = this.state;
        if (isLoading) {
            const result = await actions.login(this.loginId.toLowerCase(), this.password);
            if (this.checkLoginResponse(result))
            console.log("checklogRes",result)
            {
                this.goToChannel();
            }
        }
    };

    pingServer = async (url, retryWithHttp = true) => {
        const {
            getPing,

            // handleServerUrlChanged,
            loadConfigAndLicense,
            setServerVersion,
        } = this.props.actions;

        this.setState({
            connected: false,
            connecting: true,
            error: null,
        });

        let cancel = false;
        this.cancelPing = () => {
            cancel = true;

            this.setState({
                connected: false,
                connecting: false,
            });

            this.cancelPing = null;
        };

        const serverUrl = await this.getUrl(url, !retryWithHttp);
        Client4.setUrl(serverUrl);

        //   handleServerUrlChanged(serverUrl);

        try {
            const result = await getPing();

            if (cancel) {
                return;
            }

            if (result.error && retryWithHttp) {
                const nurl = serverUrl.replace('https:', 'http:');
                this.pingServer(nurl, false);
                return;
            }

            if (!result.error) {
                loadConfigAndLicense();
                setServerVersion(Client4.getServerVersion());
            }

            this.setState({
                connected: !result.error,
                connecting: false,
                error: result.error,
            });
        } catch {
            if (cancel) {
                return;
            }

            this.setState({
                connecting: false,
            });
        }
    };

    getUrl = async (serverUrl, useHttp = false) => {
        let url = this.sanitizeUrl(serverUrl, useHttp);

        try {
            const resp = await fetch(url, {method: 'HEAD'});
            if (resp?.rnfbRespInfo?.redirects?.length) {
                url = resp.rnfbRespInfo.redirects[resp.rnfbRespInfo.redirects.length - 1];
            }
        } catch {
            // do nothing
        }

        return this.sanitizeUrl(url, useHttp);
    };

    sanitizeUrl = (url, useHttp = false) => {
        let preUrl = urlParse(url, true);

        if (!preUrl.host || preUrl.protocol === 'file:') {
            preUrl = urlParse('https://' + stripTrailingSlashes(url), true);
        }

        if (preUrl.protocol === 'http:' && !useHttp) {
            preUrl.protocol = 'https:';
        }
        return stripTrailingSlashes(preUrl.protocol + '//' + preUrl.host + preUrl.pathname);
    };

    render() {
        const {isLoading} = this.state;

        let proceed;
        if (isLoading) {
            proceed = (
                <ActivityIndicator
                    animating={true}
                    size='small'
                />
            );
        } else {
            const additionalStyle = {};
            if (this.props.config.EmailLoginButtonColor) {
                additionalStyle.backgroundColor = this.props.config.EmailLoginButtonColor;
            }
            if (this.props.config.EmailLoginButtonBorderColor) {
                additionalStyle.borderColor = this.props.config.EmailLoginButtonBorderColor;
            }

            const additionalTextStyle = {};
            if (this.props.config.EmailLoginButtonTextColor) {
                additionalTextStyle.color = this.props.config.EmailLoginButtonTextColor;
            }

            proceed = (
                <Button
                    testID='login.signin.button'
                    onPress={this.preSignIn}
                    containerStyle={[GlobalStyles.signupButton, additionalStyle]}
                >
                    <FormattedText
                        id='login.signIn'
                        defaultMessage='Sign in'
                        style={[GlobalStyles.signupButtonText, additionalTextStyle]}
                    />
                </Button>
            );
        }

        let forgotPassword;
        if (this.props.config.EnableSignInWithEmail === 'true' || this.props.config.EnableSignInWithUsername === 'true' || this.props.config.EnableSignInWithEmail !== 'true' || this.props.config.EnableSignInWithUsername !== 'true') {
            forgotPassword = (
                <Button
                    onPress={this.forgotPassword}
                    containerStyle={[style.forgotPasswordBtn]}
                >
                    <FormattedText
                        id='login.forgot'
                        defaultMessage='I forgot my password'
                        style={style.forgotPasswordTxt}
                    />
                </Button>
            );
        }

        return (
            <SafeAreaView style={style.container}>
                <StatusBar/>
                <TouchableWithoutFeedback
                    onPress={this.blur}
                    accessible={false}
                >
                    <KeyboardAwareScrollView
                        ref={this.scrollRef}
                        style={style.container}
                        contentContainerStyle={style.innerContainer}
                        keyboardShouldPersistTaps='handled'
                        enableOnAndroid={true}
                    >
                        <Image
                            source={require('@assets/images/logo.png')}
                            style={{height: 40, resizeMode: 'contain', marginBottom: 25}}
                        />
                        <View testID='login.screen'>
                            {/* <Text style={GlobalStyles.header}>
                                {this.props.config.SiteName} 99
                            </Text> */}
                            <FormattedText
                                style={GlobalStyles.subheader}
                                id='web.root.signup_info2'
                                defaultMessage='Powering the people that power the oilfield'
                            />
                        </View>
                        <ErrorText
                            testID='login.error.text'
                            error={this.state.error}
                        />
                        <TextInput
                            allowFontScaling={true}
                            testID='login.username.input'
                            autoCapitalize='none'
                            autoCorrect={false}
                            blurOnSubmit={false}
                            disableFullscreenUI={true}
                            keyboardType='email-address'
                            onChangeText={this.handleLoginChange}
                            onSubmitEditing={this.passwordFocus}
                            placeholder={this.createLoginPlaceholder()}
                            placeholderTextColor={changeOpacity('#000', 0.5)}
                            ref={this.loginRef}
                            returnKeyType='next'
                            style={GlobalStyles.inputBox}
                            underlineColorAndroid='transparent'
                        />
                        <TextInput
                            allowFontScaling={true}
                            testID='login.password.input'
                            autoCapitalize='none'
                            autoCorrect={false}
                            disableFullscreenUI={true}
                            onChangeText={this.handlePasswordChange}
                            onSubmitEditing={this.preSignIn}
                            style={GlobalStyles.inputBox}
                            placeholder={this.context.intl.formatMessage({id: 'login.password', defaultMessage: 'Password'})}
                            placeholderTextColor={changeOpacity('#000', 0.5)}
                            ref={this.passwordRef}
                            returnKeyType='go'
                            secureTextEntry={true}
                            underlineColorAndroid='transparent'
                        />
                        {proceed}
                        {forgotPassword}
                    </KeyboardAwareScrollView>
                </TouchableWithoutFeedback>
            </SafeAreaView>
        );
    }
}

const style = StyleSheet.create({
    container: {
        flex: 1,
    },
    innerContainer: {
        alignItems: 'center',
        flexDirection: 'column',
        justifyContent: 'center',
        paddingHorizontal: 15,
        paddingVertical: 50,
    },
    forgotPasswordBtn: {
        borderColor: 'transparent',
        marginTop: 15,
    },
    forgotPasswordTxt: {
        color: '#2389D7',
    },
});
