import { SING_BOX_CONFIG, generateRuleSets, generateRules, getOutbounds, PREDEFINED_RULE_SETS} from './config.js';
import { BaseConfigBuilder } from './BaseConfigBuilder.js';
import { DeepCopy } from './utils.js';
import { t } from './i18n/index.js';

export class SingboxConfigBuilder extends BaseConfigBuilder {
    constructor(inputString, selectedRules, customRules, baseConfig, lang) {
        if (baseConfig === undefined) {
            baseConfig = SING_BOX_CONFIG;
            if (baseConfig.dns && baseConfig.dns.servers) {
                baseConfig.dns.servers[0].detour = t('outboundNames.Node Select');
            }
        }
        super(inputString, baseConfig, lang);
        this.selectedRules = selectedRules;
        this.customRules = customRules;
    }

    getProxies() {
        return this.config.outbounds.filter(outbound => outbound?.server != undefined);
    }

    getProxyName(proxy) {
        return proxy.tag;
    }

    convertProxy(proxy) {
        return proxy;
    }

    addProxyToConfig(proxy) {
        this.config.outbounds.push(proxy);
    }

    addAutoSelectGroup(proxyList) {
        this.config.outbounds.unshift({
            type: "urltest",
            tag: t('outboundNames.Auto Select'),
            outbounds: DeepCopy(proxyList),
        });
    }

    addNodeSelectGroup(proxyList) {
        // 节点选择，去掉：直连、REJECT、自动选择
        // proxyList.unshift('DIRECT', 'REJECT', t('outboundNames.Auto Select'));
        this.config.outbounds.unshift({
            type: "selector",
            tag: t('outboundNames.Node Select'),
            outbounds: proxyList
        });
    }

    addOutboundGroups(outbounds, proxyList) {
        outbounds.forEach(outbound => {
            if (outbound !== 'Node Select') {
                // 添加自己的定制化规则==================start
                if (outbound === 'Ad Block') { // 如果是广告拦截
                    this.config.outbounds.push({
                        type: "selector",
                        tag: t(`outboundNames.${outbound}`),
                        outbounds: ['REJECT', 'DIRECT']
                    });
                } else if (outbound === 'Private' || outbound === 'Location:CN' || outbound === 'Bilibili') {
                    this.config.outbounds.push({
                        type: "selector",
                        tag: t(`outboundNames.${outbound}`),
                        outbounds: ['DIRECT', ...proxyList]
                    });
                } else {
                // 添加自己的定制化规则==================end
                    this.config.outbounds.push({
                        type: "selector",
                        tag: t(`outboundNames.${outbound}`),
                        outbounds: [t('outboundNames.Node Select'), ...proxyList, 'DIRECT']
                    });
                }
            }
        });
    }

    addCustomRuleGroups(proxyList) {
        if (Array.isArray(this.customRules)) {
            this.customRules.forEach(rule => {
                this.config.outbounds.push({
                    type: "selector",
                    tag: rule.name,
                    outbounds: [t('outboundNames.Node Select'), ...proxyList]
                });
            });
        }
    }

    addFallBackGroup(proxyList) {
        this.config.outbounds.push({
            type: "selector",
            tag: t('outboundNames.Fall Back'),
            outbounds: [t('outboundNames.Node Select'), ...proxyList]
        });
    }

    formatConfig() {
        const rules = generateRules(this.selectedRules, this.customRules);
        const { site_rule_sets, ip_rule_sets } = generateRuleSets(this.selectedRules,this.customRules);

        this.config.route.rule_set = [...site_rule_sets, ...ip_rule_sets];

        this.config.route.rules = rules.map(rule => ({
            rule_set: [
              ...(rule.site_rules.length > 0 && rule.site_rules[0] !== '' ? rule.site_rules : []),
              ...(rule.ip_rules.filter(ip => ip.trim() !== '').map(ip => `${ip}-ip`))
            ],
            domain_suffix: rule.domain_suffix,
            domain_keyword: rule.domain_keyword,
            ip_cidr: rule.ip_cidr,
            protocol: rule.protocol,
            // 去掉 singbox 废弃的参数
            outbound: rule?.outbound !== 'Ad Block' ? t(`outboundNames.${rule.outbound}`) : undefined,
            // 修改为 singbox 支持的新参数
            action: rule?.outbound === 'Ad Block' ? 'reject' : undefined
        }));

        this.config.route.rules.unshift(
            // 去掉 singbox 废弃的参数
            // { protocol: 'dns', outbound: 'dns-out' },
            // 修改为 singbox 支持的新参数
            { action: 'sniff' }, { protocol: 'dns', action: 'hijack-dns' },
            { clash_mode: 'direct', outbound: 'DIRECT' },
            { clash_mode: 'global', outbound: 'GLOBAL' }
        );

        this.config.route.auto_detect_interface = true;
        this.config.route.final = t('outboundNames.Fall Back');

        return this.config;
    }
}