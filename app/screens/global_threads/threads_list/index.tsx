// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {Q} from '@nozbe/watermelondb';
import {withDatabase} from '@nozbe/watermelondb/DatabaseProvider';
import withObservables from '@nozbe/with-observables';
import {AppStateStatus} from 'react-native';
import {combineLatest, of as of$} from 'rxjs';
import {map, switchMap} from 'rxjs/operators';

import {ThreadModel} from '@app/database/models/server';
import {Preferences} from '@constants';
import {MM_TABLES, SYSTEM_IDENTIFIERS} from '@constants/database';
import {getTeammateNameDisplaySetting} from '@helpers/api/preference';

import ThreadsList, {Tab} from './threads_list';

import type {WithDatabaseArgs} from '@typings/database/database';
import type PreferenceModel from '@typings/database/models/servers/preference';
import type SystemModel from '@typings/database/models/servers/system';

export type {Tab};

const {SERVER: {CHANNEL, PREFERENCE, POST, SYSTEM, THREAD}} = MM_TABLES;

const enhanced = withObservables(['tab', 'teamId', 'forceQueryAfterAppState'], ({database, tab, teamId}: {tab: Tab; teamId: string; forceQueryAfterAppState: AppStateStatus} & WithDatabaseArgs) => {
    // Get current user
    const currentUserId = database.get<SystemModel>(SYSTEM).findAndObserve(SYSTEM_IDENTIFIERS.CURRENT_USER_ID).pipe(
        switchMap(({value}) => of$(value)),
    );

    // Query: To map threads to teams/dm/gm
    const threadsQuery: Q.Clause[] = [
        Q.experimentalNestedJoin(POST, CHANNEL),
        Q.on(
            POST,
            Q.on(
                CHANNEL,
                Q.or(
                    Q.where('team_id', teamId),
                    Q.where('team_id', ''),
                ),
            ),
        ),
    ];

    // Query: Add additional clause for unread replies
    const unreadThreadsQuery = threadsQuery.concat(Q.where('unread_replies', Q.gt(0)));

    // Get all/unread threads
    const threads = database.get<ThreadModel>(THREAD).query(
        ...(tab === 'all' ? threadsQuery : unreadThreadsQuery),
        Q.sortBy('last_reply_at', Q.desc),
    ).observe();

    // Get unreads count
    const unreadsCount = database.get<ThreadModel>(THREAD).query(
        ...unreadThreadsQuery,
    ).observeCount();

    // Get team name display setting
    const config = database.get<SystemModel>(SYSTEM).findAndObserve(SYSTEM_IDENTIFIERS.CONFIG);
    const license = database.get<SystemModel>(SYSTEM).findAndObserve(SYSTEM_IDENTIFIERS.LICENSE);
    const preferences = database.get<PreferenceModel>(PREFERENCE).query(Q.where('category', Preferences.CATEGORY_DISPLAY_SETTINGS)).observe();
    const teammateNameDisplay = combineLatest([config, license, preferences]).pipe(
        map(
            ([{value: cfg}, {value: lcs}, prefs]) => getTeammateNameDisplaySetting(prefs, cfg, lcs),
        ),
    );

    return {
        currentUserId,
        unreadsCount,
        teammateNameDisplay,
        threads,
    };
});

export default withDatabase(enhanced(ThreadsList));
