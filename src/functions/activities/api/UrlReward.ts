import type { AxiosRequestConfig } from 'axios'
import type { BasePromotion, DailySetItem, ActivityCard } from '../../../interface/DashboardData'
import { Workers } from '../../Workers'
import type { Cookie } from 'patchright'

export class UrlReward extends Workers {
    private cookieHeader: string = ''

    private fingerprintHeader: { [x: string]: string } = {}

    private gainedPoints: number = 0

    private oldBalance: number = this.bot.userData.currentPoints

    public async doUrlReward(promotion: BasePromotion) {
        if (!this.bot.requestToken && this.bot.rewardsVersion === 'legacy') {
            // this.bot.logger.warn(
            //     this.bot.isMobile,
            //     'URL-REWARD',
            //     'Skipping: Request token not available, this activity requires it!'
            // )
            // return

            // For new dashboard
            if (promotion.offerId.startsWith('Global_DailySet')) {
                await this.doDailySetviaAPI(promotion)
                return
            } else if (promotion.offerId.includes('punchcard')) {
                // await this.getPunchCardData(promotion.attributes.parentPunchcards)
                this.bot.logger.warn(
                    this.bot.isMobile,
                    'URL-REWARD',
                    'Punch Card are currently not supported yet'
                )
                return
            } else {
                await this.doMorePromotionsviaAPI(promotion)
                return
            }
        }
        // For old dashboard
        const offerId = promotion.offerId

        this.bot.logger.info(
            this.bot.isMobile,
            'URL-REWARD',
            `Starting UrlReward | offerId=${offerId} | geo=${this.bot.userData.geoLocale} | oldBalance=${this.oldBalance}`
        )

        try {
            this.cookieHeader = this.bot.browser.func.buildCookieHeader(
                this.bot.isMobile ? this.bot.cookies.mobile : this.bot.cookies.desktop,
                ['bing.com', 'live.com', 'microsoftonline.com']
            )

            const fingerprintHeaders = { ...this.bot.fingerprint.headers }
            delete fingerprintHeaders['Cookie']
            delete fingerprintHeaders['cookie']
            this.fingerprintHeader = fingerprintHeaders

            this.bot.logger.debug(
                this.bot.isMobile,
                'URL-REWARD',
                `Prepared UrlReward headers | offerId=${offerId} | cookieLength=${this.cookieHeader.length} | fingerprintHeaderKeys=${Object.keys(this.fingerprintHeader).length}`
            )

            const formData = new URLSearchParams({
                id: offerId,
                hash: promotion.hash,
                timeZone: this.bot.userData.timezoneOffset,
                activityAmount: '1',
                dbs: '0',
                form: '',
                type: '',
                __RequestVerificationToken: this.bot.requestToken
            })

            this.bot.logger.debug(
                this.bot.isMobile,
                'URL-REWARD',
                `Prepared UrlReward form data | offerId=${offerId} | hash=${promotion.hash} | timeZone=${this.bot.userData.timezoneOffset} | activityAmount=1`
            )

            const request: AxiosRequestConfig = {
                url: 'https://rewards.bing.com/api/reportactivity?X-Requested-With=XMLHttpRequest',
                method: 'POST',
                headers: {
                    ...(this.bot.fingerprint?.headers ?? {}),
                    Cookie: this.cookieHeader,
                    Referer: 'https://rewards.bing.com/',
                    Origin: 'https://rewards.bing.com'
                },
                data: formData,
                proxy: false,
                
            }

            this.bot.logger.debug(this.bot.isMobile, 'URL-REWARD', `Sending UrlReward request | offerId=${offerId}`)

            const response = await this.bot.axios.request(request)

            this.bot.logger.debug(
                this.bot.isMobile,
                'URL-REWARD',
                `Received UrlReward response | offerId=${offerId} | status=${response.status}`
            )

            const newBalance = await this.bot.browser.func.getCurrentPoints()
            this.gainedPoints = newBalance - this.oldBalance

            this.bot.logger.debug(
                this.bot.isMobile,
                'URL-REWARD',
                `Balance delta after UrlReward | offerId=${offerId} | oldBalance=${this.oldBalance} | newBalance=${newBalance} | gainedPoints=${this.gainedPoints}`
            )

            if (this.gainedPoints > 0) {
                this.bot.userData.currentPoints = newBalance
                this.bot.userData.gainedPoints = (this.bot.userData.gainedPoints ?? 0) + this.gainedPoints

                this.bot.logger.info(
                    this.bot.isMobile,
                    'URL-REWARD',
                    `Completed UrlReward | offerId=${offerId} | status=${response.status} | gainedPoints=${this.gainedPoints} | newBalance=${newBalance}`,
                    'green'
                )
            } else {
                this.bot.logger.warn(
                    this.bot.isMobile,
                    'URL-REWARD',
                    `Failed UrlReward with no points | offerId=${offerId} | status=${response.status} | oldBalance=${this.oldBalance} | newBalance=${newBalance}`
                )
            }

            this.bot.logger.debug(this.bot.isMobile, 'URL-REWARD', `Waiting after UrlReward | offerId=${offerId}`)

            await this.bot.utils.wait(this.bot.utils.randomDelay(5000, 10000))
        } catch (error) {
            this.bot.logger.error(
                this.bot.isMobile,
                'URL-REWARD',
                `Error in doUrlReward | offerId=${promotion.offerId} | message=${error instanceof Error ? error.message : String(error)}`
            )
        }
    }

    private async doMorePromotionsviaAPI(promotion: BasePromotion): Promise<void> {
        const offerId = promotion.offerId
        this.bot.logger.info(
            this.bot.isMobile,
            'URL-REWARD',
            `Starting UrlReward More Promotions | offerId=${offerId} | oldBalance=${this.oldBalance}`
        )
        try {
            // Prepare headers and cookies
            this.cookieHeader = this.bot.browser.func.buildCookieHeader(
                this.bot.isMobile ? this.bot.cookies.mobile : this.bot.cookies.desktop,
                ['bing.com', 'live.com', 'microsoftonline.com']
            )
            const fingerprintHeaders = { ...this.bot.fingerprint.headers }
            delete fingerprintHeaders['Cookie']
            delete fingerprintHeaders['cookie']
            this.fingerprintHeader = fingerprintHeaders
            this.bot.logger.debug(
                this.bot.isMobile,
                'URL-REWARD',
                `Prepared UrlReward headers | offerId=${offerId} | cookieLength=${this.cookieHeader.length}`
            )
            const availableActivityCardsItems = await this.getActivityCardItems()
            if (!availableActivityCardsItems || availableActivityCardsItems.length === 0) {
                this.bot.logger.error(
                    this.bot.isMobile,
                    'URL-REWARD',
                    `Failed to retrieve Activity Card items or no available items`
                )
                return
            }
            const targetActivityCard: ActivityCard | undefined = availableActivityCardsItems.find(
                item => item.offerId === offerId
            )
            if (!targetActivityCard) {
                this.bot.logger.error(
                    this.bot.isMobile,
                    'URL-REWARD',
                    `No matching Activity Card item found for offerId=${offerId}`
                )
                return
            }
            this.bot.logger.debug(
                this.bot.isMobile,
                'URL-REWARD',
                `Matching Activity Card item for offerId=${offerId} | found=${!!targetActivityCard} | data=${targetActivityCard ? JSON.stringify(targetActivityCard) : 'N/A'}`
            )
            // Example body:
            /* 
                [
                    "5f97876abfae8c96fb78105f2d2184e36981a8df7223cc21870fab1022a7a5c2",
                    11,
                    {
                        "offerid": "ENstar_Rewards_DailyGlobalOffer_Evergreen_Wednesday",
                        "isPromotional": "$undefined",
                        "timezoneOffset": "-420"
                    }
                ]
            */
            const formData = [
                `${targetActivityCard.hash}`,
                11,
                {
                    offerid: offerId,
                    isPromotional: '$undefined',
                    timezoneOffset: `-${this.bot.userData.timezoneOffset}`
                }
            ]
            this.bot.logger.debug(
                this.bot.isMobile,
                'URL-REWARD',
                `Prepared UrlReward form data | offerId=${offerId} | formData=${JSON.stringify(formData)}`
            )
            const request: AxiosRequestConfig = {
                url: 'https://rewards.bing.com/earn',
                method: 'POST',
                headers: {
                    ...(this.bot.fingerprint?.headers ?? {}),
                    Cookie: this.cookieHeader,
                    Accept: 'text/x-component',
                    'Accept-Encoding': 'gzip, deflate, br, zstd',
                    'Content-Type': 'text/plain;charset=UTF-8',
                    'next-action': '70babbc81d2724f60d29a95c03b3d739cba77cea92',
                    'next-router-state-tree':
                        '%5B%22%22%2C%7B%22children%22%3A%5B%22(nav)%22%2C%7B%22children%22%3A%5B%22earn%22%2C%7B%22children%22%3A%5B%22__PAGE__%22%2C%7B%7D%2Cnull%2Cnull%2C0%5D%7D%2Cnull%2Cnull%2C0%5D%7D%2Cnull%2Cnull%2C0%5D%7D%2Cnull%2Cnull%2C16%5D',
                    Origin: 'https://rewards.bing.com',
                    Referer: 'https://rewards.bing.com/earn',
                    'X-Client-Data':
                        'eyIxIjoiMCIsIjIiOiIwIiwiMyI6IjAiLCI0IjoiLTQwOTUyMjg5NjQwNzQ3ODE4OTYiLCI2Ijoic3RhYmxlIiwiOSI6ImRlc2t0b3AifQ=='
                },
                data: JSON.stringify(formData),
                proxy: false,
                
            }
            this.bot.logger.info(
                this.bot.isMobile,
                'URL-REWARD',
                `Sending UrlReward request via API | offerId=${offerId}`
            )
            const response = await this.bot.axios.request(request)
            this.bot.logger.debug(
                this.bot.isMobile,
                'URL-REWARD',
                `Received UrlReward response via API | offerId=${offerId} | status=${response.status} | responseData=${response.data}`
            )
            this.bot.logger.info(
                this.bot.isMobile,
                'URL-REWARD',
                `Sent UrlReward request via API | offerId=${offerId} | status=${response.status}`
            )
            // calculate points gained
            const newBalance = await this.bot.browser.func.getCurrentPoints()
            this.gainedPoints = newBalance - this.oldBalance
            this.bot.logger.debug(
                this.bot.isMobile,
                'URL-REWARD',
                `Balance delta after UrlReward | offerId=${offerId} | oldBalance=${this.oldBalance} | newBalance=${newBalance} | gainedPoints=${this.gainedPoints}`
            )
            if (this.gainedPoints > 0) {
                this.bot.userData.currentPoints = newBalance
                this.bot.userData.gainedPoints = (this.bot.userData.gainedPoints ?? 0) + this.gainedPoints

                this.bot.logger.info(
                    this.bot.isMobile,
                    'URL-REWARD',
                    `Completed UrlReward | offerId=${offerId} | status=${response.status} | gainedPoints=${this.gainedPoints} | newBalance=${newBalance}`,
                    'green'
                )
            } else {
                this.bot.logger.warn(
                    this.bot.isMobile,
                    'URL-REWARD',
                    `Failed UrlReward with no points | offerId=${offerId} | status=${response.status} | oldBalance=${this.oldBalance} | newBalance=${newBalance}`
                )
            }
            this.bot.logger.debug(this.bot.isMobile, 'URL-REWARD', `Waiting after UrlReward | offerId=${offerId}`)
            await this.bot.utils.wait(this.bot.utils.randomDelay(5000, 10000))
        } catch (error) {
            this.bot.logger.error(
                this.bot.isMobile,
                'URL-REWARD',
                `Error in doUrlRewardMorePromotionsViaAPI | offerId=${offerId} | message=${error instanceof Error ? error.message : String(error)}`
            )
        }
    }

    private async doDailySetviaAPI(promotion: BasePromotion): Promise<void> {
        const offerId = promotion.offerId
        this.bot.logger.info(
            this.bot.isMobile,
            'URL-REWARD',
            `Starting UrlReward Daily Set | offerId=${offerId} | oldBalance=${this.oldBalance}`
        )

        try {
            // Prepare headers and cookies
            this.cookieHeader = this.bot.browser.func.buildCookieHeader(
                this.bot.isMobile ? this.bot.cookies.mobile : this.bot.cookies.desktop,
                ['bing.com', 'live.com', 'microsoftonline.com']
            )
            const fingerprintHeaders = { ...this.bot.fingerprint.headers }
            delete fingerprintHeaders['Cookie']
            delete fingerprintHeaders['cookie']
            this.fingerprintHeader = fingerprintHeaders
            this.bot.logger.debug(
                this.bot.isMobile,
                'URL-REWARD',
                `Prepared UrlReward headers | offerId=${offerId} | cookieLength=${this.cookieHeader.length}`
            )
            this.bot.logger.debug(this.bot.isMobile, 'URL-REWARD', `Prepared UrlReward form data | offerId=${offerId}`)
            const dailySetItems = await this.getDailySetItems()
            if (!dailySetItems) {
                this.bot.logger.error(this.bot.isMobile, 'URL-REWARD', `Failed to retrieve Daily Set items`)
                return
            }
            const targetDailySet: DailySetItem | void = dailySetItems?.find(item => item.offerId === offerId)
            if (!targetDailySet) {
                this.bot.logger.error(
                    this.bot.isMobile,
                    'URL-REWARD',
                    `No matching Daily Set item found for offerId=${offerId}`
                )
                return
            }
            this.bot.logger.debug(
                this.bot.isMobile,
                'URL-REWARD',
                `Matching Daily Set item for offerId=${offerId} | found=${!!targetDailySet} | data=${targetDailySet ? JSON.stringify(targetDailySet) : 'N/A'}`
            )
            // Example body
            /* ["f9e949b796df7434fdfc9fe16935c3c4a99ab5d25947109652e0ce220559d9b8",11,{"offerid":"Global_DailySet_20260526_Child2","isPromotional":"$undefined","timezoneOffset":"-420"}] */
            const formData = [
                `${targetDailySet.hash}`,
                11,
                {
                    offerid: offerId,
                    isPromotional: '$undefined',
                    timezoneOffset: `-${this.bot.userData.timezoneOffset}`
                }
            ]
            this.bot.logger.debug(
                this.bot.isMobile,
                'URL-REWARD',
                `Prepared UrlReward form data | offerId=${offerId} | formData=${JSON.stringify(formData)}`
            )
            const request: AxiosRequestConfig = {
                url: 'https://rewards.bing.com/dashboard',
                method: 'POST',
                headers: {
                    ...(this.bot.fingerprint?.headers ?? {}),
                    Cookie: this.cookieHeader,
                    Referer: 'https://rewards.bing.com/dashboard',
                    Origin: 'https://rewards.bing.com',
                    Accept: 'text/x-component',
                    'Content-Type': 'text/plain;charset=UTF-8',
                    'next-action': '70babbc81d2724f60d29a95c03b3d739cba77cea92',
                    'next-router-state-tree':
                        '%5B%22%22%2C%7B%22children%22%3A%5B%22(nav)%22%2C%7B%22children%22%3A%5B%22dashboard%22%2C%7B%22children%22%3A%5B%22__PAGE__%22%2C%7B%7D%2Cnull%2Cnull%2C0%5D%7D%2Cnull%2Cnull%2C0%5D%7D%2Cnull%2Cnull%2C0%5D%7D%2Cnull%2Cnull%2C16%5D',
                    'Accept-Encoding': 'gzip, deflate, br, zstd',
                    'Accept-Language': 'vi-VN,vi;q=0.9,fr-FR;q=0.8,fr;q=0.7,en-US;q=0.6,en;q=0.5',
                    'X-Client-Data':
                        'eyIxIjoiMCIsIjIiOiIwIiwiMyI6IjAiLCI0IjoiLTQwOTUyMjg5NjQwNzQ3ODE4OTYiLCI2Ijoic3RhYmxlIiwiOSI6ImRlc2t0b3AifQ=='
                },
                data: JSON.stringify(formData),
                proxy: false,
                
            }
            const response = await this.bot.axios.request(request)
            this.bot.logger.info(
                this.bot.isMobile,
                'URL-REWARD',
                `Sent UrlReward request via API | offerId=${offerId} | status=${response.status}`
            )
            this.bot.logger.debug(
                this.bot.isMobile,
                'URL-REWARD',
                `Received UrlReward response via API | offerId=${offerId} | status=${response.data.status} | responseData=${response.data}`
            )
            // calculate points gained
            const newBalance = await this.bot.browser.func.getCurrentPoints()
            this.gainedPoints = newBalance - this.oldBalance
            this.bot.logger.debug(
                this.bot.isMobile,
                'URL-REWARD',
                `Balance delta after UrlReward | offerId=${offerId} | oldBalance=${this.oldBalance} | newBalance=${newBalance} | gainedPoints=${this.gainedPoints}`
            )
            if (this.gainedPoints > 0) {
                this.bot.userData.currentPoints = newBalance
                this.bot.userData.gainedPoints = (this.bot.userData.gainedPoints ?? 0) + this.gainedPoints

                this.bot.logger.info(
                    this.bot.isMobile,
                    'URL-REWARD',
                    `Completed UrlReward | offerId=${offerId} | status=${response.status} | gainedPoints=${this.gainedPoints} | newBalance=${newBalance}`,
                    'green'
                )
            } else {
                this.bot.logger.warn(
                    this.bot.isMobile,
                    'URL-REWARD',
                    `Failed UrlReward with no points | offerId=${offerId} | status=${response.status} | oldBalance=${this.oldBalance} | newBalance=${newBalance}`
                )
            }
            this.bot.logger.debug(this.bot.isMobile, 'URL-REWARD', `Waiting after UrlReward | offerId=${offerId}`)
            await this.bot.utils.wait(this.bot.utils.randomDelay(5000, 10000))
        } catch (error) {
            this.bot.logger.error(
                this.bot.isMobile,
                'URL-REWARD',
                `Error in doUrlRewardUsingAPI | offerId=${offerId} | message=${error instanceof Error ? error.message : String(error)}`
            )
        }
    }

    private async getDailySetItems(): Promise<DailySetItem[] | void> {
        try {
            // request React Server Components
            this.bot.logger.debug(
                this.bot.isMobile,
                'URL-REWARD',
                `Prepraring headers for fetching Daily Set items | cookieLength=${this.cookieHeader.length}`
            )
            const request: AxiosRequestConfig = {
                url: 'https://rewards.bing.com/dashboard',
                method: 'GET',
                headers: {
                    ...(this.bot.fingerprint?.headers ?? {}),
                    Cookie: this.cookieHeader,
                    Accept: '*/*',
                    'Accept-Encoding': 'gzip, deflate, br, zstd',
                    'Accept-Language': 'en-US,en;q=0.9',
                    'next-router-state-tree':
                        '%5B%22%22%2C%7B%22children%22%3A%5B%22(nav)%22%2C%7B%22children%22%3A%5B%22dashboard%22%2C%7B%22children%22%3A%5B%22__PAGE__%22%2C%7B%7D%2Cnull%2Cnull%2C0%5D%7D%2Cnull%2Cnull%2C0%5D%7D%2Cnull%2Cnull%2C0%5D%7D%2Cnull%2C%22refetch%22%2C16%5D',
                    Referer: 'https://rewards.bing.com/dashboard',
                    rsc: 1,
                    'X-Client-Data':
                        'eyIxIjoiMCIsIjIiOiIwIiwiMyI6IjAiLCI0IjoiLTQwOTUyMjg5NjQwNzQ3ODE4OTYiLCI2Ijoic3RhYmxlIiwiOSI6ImRlc2t0b3AifQ=='
                },
                proxy: false,
                
            }
            const response = await this.bot.axios.request(request)
            this.bot.logger.debug(
                this.bot.isMobile,
                'URL-REWARD',
                `Received response for Daily Set items | status=${response.status} | dataLength=${response.data.length}`
            )
            // fs.writeFileSync('dailySetResponse.txt', response.data)
            const match = response.data.match(/"dailySetItems":\s*(\[[\s\S]*?\])/)
            if (!match) {
                this.bot.logger.error(
                    this.bot.isMobile,
                    'URL-REWARD',
                    `Failed to extract dailySetItems from response or no daily set items available`
                )
                return
            }
            const dailySetItems = JSON.parse(match[1])
            const today = this.bot.utils.getFormattedDate()
            const todayDailySets: DailySetItem[] = dailySetItems.filter((item: DailySetItem) => item.date === today)
            this.bot.logger.info(
                this.bot.isMobile,
                'URL-REWARD',
                `Extracted Daily Set items for today | date=${today} | found ${todayDailySets.length} available items`
            )
            this.bot.logger.debug(
                this.bot.isMobile,
                'URL-REWARD',
                `Today's Daily Set items data | date=${today} | items=${JSON.stringify(todayDailySets)}`
            )
            return todayDailySets
        } catch (error) {
            this.bot.logger.error(
                this.bot.isMobile,
                'URL-REWARD',
                `Error in getDailySetItems | message=${error instanceof Error ? error.message : String(error)}`
            )
        }
    }

    // Get available Activity Card items (morePromotion)
    private async getActivityCardItems(): Promise<ActivityCard[] | void> {
        try {
            this.bot.logger.debug(this.bot.isMobile, 'URL-REWARD', `Prepraring to fetch available Activity Card items`)
            const request: AxiosRequestConfig = {
                url: 'https://rewards.bing.com/earn',
                method: 'GET',
                headers: {
                    ...(this.bot.fingerprint?.headers ?? {}),
                    Cookie: this.cookieHeader,
                    Accept: '*/*',
                    'Accept-Encoding': 'gzip, deflate, br, zstd',
                    'next-router-state-tree':
                        '%5B%22%22%2C%7B%22children%22%3A%5B%22(nav)%22%2C%7B%22children%22%3A%5B%22earn%22%2C%7B%22children%22%3A%5B%22__PAGE__%22%2C%7B%7D%2Cnull%2Cnull%2C0%5D%7D%2Cnull%2Cnull%2C0%5D%7D%2Cnull%2Cnull%2C0%5D%7D%2Cnull%2C%22refetch%22%2C16%5D',
                    Referer: 'https://rewards.bing.com/earn',
                    rsc: 1,
                    'X-Client-Data':
                        'eyIxIjoiMCIsIjIiOiIwIiwiMyI6IjAiLCI0IjoiLTQwOTUyMjg5NjQwNzQ3ODE4OTYiLCI2Ijoic3RhYmxlIiwiOSI6ImRlc2t0b3AifQ=='
                },
                proxy: false,
                
            }
            const response = await this.bot.axios.request(request)
            this.bot.logger.debug(
                this.bot.isMobile,
                'URL-REWARD',
                `Received response for Activity Card items | status=${response.status} | dataLength=${response.data.length}`
            )
            const match = response.data.match(/"activityCards":\s*(\[[\s\S]*?\])/)
            if (!match) {
                this.bot.logger.error(
                    this.bot.isMobile,
                    'URL-REWARD',
                    `Failed to extract activityCards from response or no activity cards available`
                )
                return
            }
            const activityCardItems = JSON.parse(match[1])
            const availableActivityCards: ActivityCard[] = activityCardItems.filter(
                (item: ActivityCard) =>
                    item.points > 0 &&
                    (item.isLocked == '$undefined' || item.isLocked == false) &&
                    item.isCompleted == false
            )
            this.bot.logger.info(
                this.bot.isMobile,
                'URL-REWARD',
                `Extracted available Activity Card items | found ${availableActivityCards.length} available activity`
            )
            this.bot.logger.debug(
                this.bot.isMobile,
                'URL-REWARD',
                `Available Activity Card items data | items=${JSON.stringify(availableActivityCards)}`
            )
            return availableActivityCards
        } catch (error) {
            this.bot.logger.error(
                this.bot.isMobile,
                'URL-REWARD',
                `Error in getActivityCardItems | message=${error instanceof Error ? error.message : String(error)}`
            )
        }
    }

    // private async doPunchCardViaAPI(promotion: BasePromotion): Promise<string | void> {
    //     try {
    //         const offerId = promotion.offerId
    //         const parentOfferId = promotion.attributes.parentPunchcards
    //         this.bot.logger.info(
    //             this.bot.isMobile,
    //             'URL-REWARD',
    //             `Starting UrlReward Punch Card | offerId=${offerId} | oldBalance=${this.oldBalance}`
    //         )
    //         // Fetch punch card hash using offerId and parentOfferId
    //         const punchCardHash = await this.getPunchCardHash(offerId, parentOfferId)
    //         return punchCardHash
    //     } catch (error) {
    //         this.bot.logger.error(
    //             this.bot.isMobile,
    //             'URL-REWARD',
    //             `Error in doPunchCardViaAPI | offerId=${promotion.offerId} | message=${error instanceof Error ? error.message : String(error)}`
    //         )
    //     }
    // }

    buildCookieHeader(cookies: Cookie[], allowedDomains?: string[]): string {
        return [
            ...new Map(
                cookies
                    .filter(c => {
                        if (!allowedDomains || allowedDomains.length === 0) return true
                        return (
                            typeof c.domain === 'string' &&
                            allowedDomains.some(d => c.domain.toLowerCase().endsWith(d.toLowerCase()))
                        )
                    })
                    .map(c => [c.name, c])
            ).values()
        ]
            .map(c => `${c.name}=${c.value}`)
            .join('; ')
    }

    // private async getPunchCardData(parentOfferId: string): Promise<string | void> {
    //     try {
    //         this.bot.logger.info(
    //             this.bot.isMobile,
    //             'URL-REWARD',
    //             `Prepraring to fetch Punch Card data | parentOfferId=${parentOfferId}`
    //         )
    //         const request: AxiosRequestConfig = {
    //             url: `https://rewards.bing.com/earn/quest/${parentOfferId}`,
    //             method: 'GET',
    //             headers: {
    //                 ...(this.bot.fingerprint?.headers ?? {}),
    //                 Cookie: this.buildCookieHeader(this.bot.cookies.desktop, [
    //                     'bing.com',
    //                     'live.com',
    //                     'microsoftonline.com'
    //                 ]),
    //                 Accept: '*/*',
    //                 'Accept-Encoding': 'gzip, deflate, br, zstd',
    //                 Host: 'rewards.bing.com',
    //                 'next-router-state-tree': `%5B%22%22%2C%7B%22children%22%3A%5B%22(nav)%22%2C%7B%22children%22%3A%5B%22earn%22%2C%7B%22children%22%3A%5B%22quest%22%2C%7B%22children%22%3A%5B%5B%22questId%22%2C%22${parentOfferId}%22%2C%22d%22%2Cnull%5D%2C%7B%22children%22%3A%5B%22__PAGE__%22%2C%7B%7D%2Cnull%2Cnull%2C0%5D%7D%2Cnull%2Cnull%2C0%5D%7D%2Cnull%2Cnull%2C0%5D%7D%2Cnull%2Cnull%2C0%5D%7D%2Cnull%2Cnull%2C0%5D%7D%2Cnull%2C%22refetch%22%2C16%5D`,
    //                 'next-url': '/earn',
    //                 rsc: '1',
    //                 Referer: 'https://rewards.bing.com/earn'
    //             },
    //             proxy: false,
    //         }
    //         this.bot.logger.info(
    //             this.bot.isMobile,
    //             'URL-REWARD',
    //             `Sending request to fetch Punch Card data | parentOfferId=${parentOfferId}`
    //         )
    //         const response = await this.bot.axios.request(request)
    //         this.bot.logger.debug(
    //             this.bot.isMobile,
    //             'URL-REWARD',
    //             `Received response for Punch Card data | parentOfferId=${parentOfferId} | status=${response.status} | dataLength=${response.data.length} | data=${response.data}`
    //         )
    //     } catch (error) {
    //         this.bot.logger.error(
    //             this.bot.isMobile,
    //             'URL-REWARD',
    //             `Error in getPunchCardData | parentOfferId=${parentOfferId} | message=${error instanceof Error ? error.message : String(error)}`
    //         )
    //     }
    // }
}
