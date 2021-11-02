import { expect as expectCDK, matchTemplate, MatchStyle } from '@aws-cdk/assert';
import * as cdk from '@aws-cdk/core';
import * as UpworkTest from '../lib/upwork_test-stack';

test('Empty Stack', () => {
    const app = new cdk.App();
    // WHEN
    const stack = new UpworkTest.UpworkTestStack(app, 'MyTestStack');
    // THEN
    expectCDK(stack).to(matchTemplate({
      "Resources": {}
    }, MatchStyle.EXACT));
});
