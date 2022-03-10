// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {StyleSheet, View, Image} from 'react-native';

//import CompassIcon from '@components/compass_icon';
//import {ViewTypes} from '@constants';

//import type {Theme} from '@mm-redux/types/theme';

// type Props = {
//     theme: Theme;
// }

const styles = StyleSheet.create({
    profilePictureContainer: {
        marginBottom: 5,
        marginLeft: 12,
        marginRight: 13,
        marginTop: 10,
    },
});

const SystemAvatar = () => {
    return (
        <View style={styles.profilePictureContainer}>
            {/* <CompassIcon
                name='mattermost'
                color={theme.centerChannelColor}
                size={ViewTypes.PROFILE_PICTURE_SIZE}
            /> */}

            <Image
                source={require('@assets/images/icon.png')}
                style={{height: 40, width: 40, resizeMode: 'contain'}}
            />
        </View>
    );
};

export default SystemAvatar;
