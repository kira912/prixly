<script setup lang="ts">
const { t } = useI18n()
</script>

<template>
  <ol class="steps">
    <li>
      <span class="step-num" aria-hidden="true">1</span>
      <div>
        <h3>{{ t('howItWorks.step1Title') }}</h3>
        <i18n-t keypath="howItWorks.step1Text" tag="p" scope="global">
          <template #action>
            <strong>{{ t('howItWorks.step1Action') }}</strong>
          </template>
        </i18n-t>
      </div>
    </li>
    <li>
      <span class="step-num" aria-hidden="true">2</span>
      <div>
        <h3>{{ t('howItWorks.step2Title') }}</h3>
        <p>{{ t('howItWorks.step2Text') }}</p>
      </div>
    </li>
    <li>
      <span class="step-num" aria-hidden="true">3</span>
      <div>
        <h3>{{ t('howItWorks.step3Title') }}</h3>
        <p>{{ t('howItWorks.step3Text') }}</p>
      </div>
    </li>
  </ol>
</template>
