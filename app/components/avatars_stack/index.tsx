// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useCallback} from 'react';
import {useIntl} from 'react-intl';
import {Platform, StyleProp, Text, View, ViewStyle} from 'react-native';

import FormattedText from '@components/formatted_text';
import ProfilePicture from '@components/profile_picture';
import TouchableWithFeedback from '@components/touchable_with_feedback';
import {useTheme} from '@context/theme';
import {bottomSheet} from '@screens/navigation';
import {preventDoubleTap} from '@utils/tap';
import {changeOpacity, makeStyleSheetFromTheme} from '@utils/theme';

import UsersList from './users_list';

import type UserModel from '@typings/database/models/servers/user';

const OVERFLOW_DISPLAY_LIMIT = 99;

type Props = {
    currentUserId: string;
    users: UserModel[];
    breakAt?: number;
    style?: StyleProp<ViewStyle>;
    teammateNameDisplay: string;
}

const Avatars = ({breakAt = 3, currentUserId, style: baseContainerStyle, teammateNameDisplay, users}: Props) => {
    const theme = useTheme();
    const intl = useIntl();

    const showParticipantsList = useCallback(preventDoubleTap(() => {
        const renderContent = () => (
            <>
                <View style={style.listHeader}>
                    <FormattedText
                        id='mobile.participants.header'
                        defaultMessage={'THREAD PARTICIPANTS'}
                        style={style.listHeaderText}
                    />
                </View>
                <UsersList
                    currentUserId={currentUserId}
                    teammateNameDisplay={teammateNameDisplay}
                    theme={theme}
                    users={users}
                />
            </>
        );

        bottomSheet({
            closeButtonId: 'close-set-user-status',
            renderContent,
            snapPoints: [(Math.min(14, users.length) + 3) * 40, 10],
            title: intl.formatMessage({id: 'mobile.participants.header', defaultMessage: 'THREAD PARTICIPANTS'}),
            theme,
        });
    }), [teammateNameDisplay, theme, users]);

    const displayUsers = users.slice(0, breakAt);
    const overflowUsersCount = Math.min(users.length - displayUsers.length, OVERFLOW_DISPLAY_LIMIT);

    const style = getStyleSheet(theme);

    return (
        <TouchableWithFeedback
            onPress={showParticipantsList}
            style={baseContainerStyle}
            type={'opacity'}
        >
            <View style={style.container}>
                {displayUsers.map((user, index) => (
                    <View
                        key={user.id}
                        style={index === 0 ? style.firstAvatar : style.notFirstAvatars}
                    >
                        <ProfilePicture
                            author={user}
                            size={24}
                            showStatus={false}
                            testID='avatars.profile_picture'
                        />
                    </View>
                ))}
                {Boolean(overflowUsersCount) && (
                    <View style={style.overflowContainer}>
                        <View style={style.overflowItem}>
                            <Text style={style.overflowText} >
                                {'+' + overflowUsersCount.toString()}
                            </Text>
                        </View>
                    </View>
                )}
            </View>
        </TouchableWithFeedback>
    );
};

const getStyleSheet = makeStyleSheetFromTheme((theme: Theme) => {
    const size = 24;

    let STATUS_BUFFER = Platform.select({
        ios: 3,
        android: 2,
    });
    STATUS_BUFFER = STATUS_BUFFER || 0;
    const overflowSize = size + STATUS_BUFFER;
    const imgOverlap = -6;
    return {
        container: {
            flexDirection: 'row',
        },
        firstAvatar: {
            justifyContent: 'center',
            alignItems: 'center',
            width: size,
            height: size,
            borderWidth: (size / 2) + 1,
            borderColor: theme.centerChannelBg,
            backgroundColor: theme.centerChannelBg,
            borderRadius: size / 2,
        },
        notFirstAvatars: {
            justifyContent: 'center',
            alignItems: 'center',
            width: size,
            height: size,
            borderWidth: (size / 2) + 1,
            borderColor: theme.centerChannelBg,
            backgroundColor: theme.centerChannelBg,
            borderRadius: size / 2,
            marginLeft: imgOverlap,
        },
        overflowContainer: {
            justifyContent: 'center',
            alignItems: 'center',
            width: overflowSize,
            height: overflowSize,
            borderRadius: overflowSize / 2,
            borderWidth: 1,
            borderColor: theme.centerChannelBg,
            backgroundColor: theme.centerChannelBg,
            marginLeft: imgOverlap,
        },
        overflowItem: {
            justifyContent: 'center',
            alignItems: 'center',
            width: overflowSize,
            height: overflowSize,
            borderRadius: overflowSize / 2,
            borderWidth: 1,
            borderColor: theme.centerChannelBg,
            backgroundColor: changeOpacity(theme.centerChannelColor, 0.08),
        },
        overflowText: {
            fontSize: 10,
            fontWeight: 'bold',
            color: changeOpacity(theme.centerChannelColor, 0.64),
            textAlign: 'center',
        },
        listHeader: {
            marginBottom: 12,
        },
        listHeaderText: {
            color: changeOpacity(theme.centerChannelColor, 0.56),
            fontSize: 12,
            fontWeight: '600',
        },
    };
});

export default Avatars;
